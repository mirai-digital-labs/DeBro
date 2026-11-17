import crypto from 'crypto';
import { Order, PaymentGateway, PaymentStatus, PaymentTransaction, PaymentSession } from '@platform/types';
import { IPaymentProvider, AuthorizePaymentPayload, WebhookResult } from '../interfaces.js';

export class StripeProvider implements IPaymentProvider {
  public readonly gateway: PaymentGateway = 'STRIPE';
  private webhookSecret: string;

  constructor() {
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_stripe_test_secret_key_998877';
  }

  public async createSession(order: Order, _idempotencyKey: string): Promise<PaymentSession> {
    const intentId = `pi_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const clientSecret = `${intentId}_secret_${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    return {
      id: intentId,
      orderId: order.id,
      gateway: this.gateway,
      amount: order.total,
      currency: order.currency || 'USD',
      clientSecret,
      expiresAt,
      status: 'PENDING',
    };
  }

  public async authorize(payload: AuthorizePaymentPayload): Promise<PaymentTransaction> {
    const { orderId, amount, currency, paymentDetails } = payload;

    // Simulate basic card validation
    if (paymentDetails.cardToken && paymentDetails.cardToken.includes('declined')) {
      const error: any = new Error('Stripe Card Error: Your card was declined by the issuing bank.');
      error.status = 402;
      throw error;
    }

    const chargeId = `ch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    return {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId,
      gateway: this.gateway,
      status: 'CAPTURED',
      amount,
      currency: currency || 'USD',
      transactionReference: chargeId,
      idempotencyKey: payload.sessionId,
      createdAt: now,
    };
  }

  public async capture(transactionId: string): Promise<PaymentTransaction> {
    return {
      id: transactionId,
      orderId: '',
      gateway: this.gateway,
      status: 'CAPTURED',
      amount: 0,
      currency: 'USD',
      idempotencyKey: '',
      createdAt: new Date().toISOString(),
    };
  }

  public async refund(transaction: PaymentTransaction, amount?: number, reason?: string): Promise<PaymentTransaction> {
    const refundAmount = amount || transaction.amount;
    const refundRef = `re_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId: transaction.orderId,
      gateway: this.gateway,
      status: 'REFUNDED',
      amount: refundAmount,
      currency: transaction.currency,
      transactionReference: refundRef,
      idempotencyKey: `refund_${transaction.id}`,
      createdAt: new Date().toISOString(),
    };
  }

  public async handleWebhook(headers: Record<string, string>, body: any): Promise<WebhookResult> {
    const sigHeader = headers['stripe-signature'];
    if (!sigHeader) {
      const error: any = new Error('Stripe Webhook: Missing stripe-signature header.');
      error.status = 401;
      throw error;
    }

    const isValid = this.verifySignature(body, sigHeader, this.webhookSecret);
    if (!isValid) {
      const error: any = new Error('Stripe Webhook: Invalid signature or timestamp mismatch.');
      error.status = 401;
      throw error;
    }

    const event = body;
    const eventType = event.type;
    const paymentIntent = event.data?.object || {};

    let status: PaymentStatus = 'PENDING';
    if (eventType === 'payment_intent.succeeded') {
      status = 'CAPTURED';
    } else if (eventType === 'payment_intent.payment_failed') {
      status = 'FAILED';
    } else if (eventType === 'charge.refunded') {
      status = 'REFUNDED';
    }

    return {
      handled: true,
      orderId: paymentIntent.metadata?.orderId || paymentIntent.description,
      transactionReference: paymentIntent.id,
      status,
      amount: paymentIntent.amount ? paymentIntent.amount / 100 : 0,
      currency: paymentIntent.currency?.toUpperCase() || 'USD',
      metadata: event,
    };
  }

  public verifySignature(payload: any, signatureHeader: string, secret: string): boolean {
    // Stripe format: t=timestamp,v1=signature
    const parts = signatureHeader.split(',');
    let timestamp = '';
    let signature = '';

    for (const part of parts) {
      const [key, val] = part.split('=');
      if (key === 't') timestamp = val;
      if (key === 'v1') signature = val;
    }

    if (!timestamp || !signature) {
      return false;
    }

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signedPayload = `${timestamp}.${payloadString}`;
    const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    const bufExpected = Buffer.from(expected);
    const bufSig = Buffer.from(signature);

    if (bufExpected.length !== bufSig.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufExpected, bufSig);
  }
}
