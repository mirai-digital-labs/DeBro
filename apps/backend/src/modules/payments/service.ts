import { Order, PaymentGateway, PaymentStatus, PaymentTransaction, PaymentSession } from '@platform/types';
import { IPaymentProvider, AuthorizePaymentPayload, WebhookResult } from './interfaces.js';
import { JazzCashProvider } from './adapters/jazzcash.js';
import { EasypaisaProvider } from './adapters/easypaisa.js';
import { StripeProvider } from './adapters/stripe.js';
import { CodProvider } from './adapters/cod.js';
import { cartService } from '../cart/service.js';
import { orderStateMachineService } from '../orders/service.js';

export class PaymentService {
  private providers: Map<PaymentGateway, IPaymentProvider> = new Map();
  private sessions: Map<string, PaymentSession> = new Map();
  private transactions: Map<string, PaymentTransaction> = new Map();
  private idempotencyStore: Map<string, PaymentTransaction> = new Map();
  private processedWebhookEvents: Set<string> = new Set();

  constructor() {
    this.registerProvider(new JazzCashProvider());
    this.registerProvider(new EasypaisaProvider());
    this.registerProvider(new StripeProvider());
    this.registerProvider(new CodProvider());
  }

  public registerProvider(provider: IPaymentProvider) {
    this.providers.set(provider.gateway, provider);
  }

  public getProvider(gateway: PaymentGateway): IPaymentProvider {
    const provider = this.providers.get(gateway);
    if (!provider) {
      const error: any = new Error(`Payment gateway '${gateway}' is not supported or active.`);
      error.status = 400;
      throw error;
    }
    return provider;
  }

  // --------------------------------------------------------------------------
  // 1. Session Initialization
  // --------------------------------------------------------------------------
  public async createSession(
    orderIdOrNumber: string,
    gateway: PaymentGateway,
    idempotencyKey?: string
  ): Promise<PaymentSession> {
    const order = cartService.getOrder(orderIdOrNumber);
    if (!order) {
      const error: any = new Error(`Order '${orderIdOrNumber}' not found.`);
      error.status = 404;
      throw error;
    }

    const key = idempotencyKey || `sess_${order.id}_${gateway}`;
    const provider = this.getProvider(gateway);
    const session = await provider.createSession(order, key);

    this.sessions.set(session.id, session);
    return session;
  }

  public getSession(sessionId: string): PaymentSession | null {
    return this.sessions.get(sessionId) || null;
  }

  // --------------------------------------------------------------------------
  // 2. Payment Authorization & Capture (Idempotent)
  // --------------------------------------------------------------------------
  public async authorizePayment(
    sessionId: string,
    paymentDetails: any,
    idempotencyKey?: string
  ): Promise<PaymentTransaction> {
    const session = this.getSession(sessionId);
    if (!session) {
      const error: any = new Error(`Payment session '${sessionId}' not found.`);
      error.status = 404;
      throw error;
    }

    // Check Idempotency Store (Defense against double-billing)
    const iKey = idempotencyKey || session.id;
    if (this.idempotencyStore.has(iKey)) {
      console.log(`[Idempotency] Returning cached payment transaction for key '${iKey}'`);
      return this.idempotencyStore.get(iKey)!;
    }

    const provider = this.getProvider(session.gateway);
    const payload: AuthorizePaymentPayload = {
      sessionId: session.id,
      orderId: session.orderId,
      gateway: session.gateway,
      amount: session.amount,
      currency: session.currency,
      paymentDetails,
    };

    const transaction = await provider.authorize(payload);

    // Save transaction and cache idempotency
    this.transactions.set(transaction.id, transaction);
    this.idempotencyStore.set(iKey, transaction);
    session.status = transaction.status;

    // Transition Order Lifecycle if paid/captured
    if (transaction.status === 'CAPTURED') {
      try {
        orderStateMachineService.transitionOrder(
          session.orderId,
          'PAID',
          'SYSTEM',
          `Payment verified & captured via ${session.gateway} (Ref: ${transaction.transactionReference})`
        );
      } catch (e) {
        // Order may already be in PAID or CONFIRMED state (COD)
      }
    }

    return transaction;
  }

  // --------------------------------------------------------------------------
  // 3. Webhook Ingestion & Replay Protection
  // --------------------------------------------------------------------------
  public async processWebhook(
    gateway: PaymentGateway,
    headers: Record<string, string>,
    body: any
  ): Promise<WebhookResult> {
    const provider = this.getProvider(gateway);

    // Replay attack defense
    const eventId = headers['x-webhook-id'] || body.eventId || body.pp_TxnRefNo || body.id;
    if (eventId && this.processedWebhookEvents.has(eventId)) {
      console.warn(`[Replay Attack Defense] Dropping duplicate webhook event '${eventId}'`);
      return {
        handled: true,
        status: 'CAPTURED',
        metadata: { replayIgnored: true, eventId },
      };
    }

    const result = await provider.handleWebhook(headers, body);

    if (eventId) {
      this.processedWebhookEvents.add(eventId);
    }

    // Update order status if orderId exists
    if (result.orderId && result.status === 'CAPTURED') {
      try {
        orderStateMachineService.transitionOrder(
          result.orderId,
          'PAID',
          'SYSTEM',
          `Payment captured via ${gateway} webhook (Ref: ${result.transactionReference})`
        );
      } catch (e) {
        // Order might already be paid/confirmed
      }
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // 4. Refunds & Reversals
  // --------------------------------------------------------------------------
  public async refundPayment(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<PaymentTransaction> {
    const tx = this.transactions.get(transactionId);
    if (!tx) {
      const error: any = new Error(`Payment transaction '${transactionId}' not found.`);
      error.status = 404;
      throw error;
    }

    if (tx.status === 'REFUNDED') {
      return tx; // Idempotent
    }

    const provider = this.getProvider(tx.gateway);
    const refundTx = await provider.refund(tx, amount, reason);

    // Update local state
    tx.status = 'REFUNDED';
    this.transactions.set(refundTx.id, refundTx);

    // Transition Order to REFUNDED
    try {
      orderStateMachineService.transitionOrder(
        tx.orderId,
        'REFUNDED',
        'ADMIN',
        `Payment refunded via ${tx.gateway}: Rs. ${refundTx.amount} (Reason: ${reason || 'Customer request'})`
      );
    } catch (e) {
      // Ignore if order is already transitioned
    }

    return refundTx;
  }

  // --------------------------------------------------------------------------
  // 5. Lookups
  // --------------------------------------------------------------------------
  public getTransaction(transactionId: string): PaymentTransaction | null {
    return this.transactions.get(transactionId) || null;
  }

  public getOrderTransactions(orderId: string): PaymentTransaction[] {
    return Array.from(this.transactions.values()).filter((tx) => tx.orderId === orderId);
  }
}

// Singleton Service Instance
export const paymentService = new PaymentService();
