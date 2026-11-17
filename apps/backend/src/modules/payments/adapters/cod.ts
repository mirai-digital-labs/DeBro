import { Order, PaymentGateway, PaymentStatus, PaymentTransaction, PaymentSession } from '@platform/types';
import { IPaymentProvider, AuthorizePaymentPayload, WebhookResult } from '../interfaces.js';

export class CodProvider implements IPaymentProvider {
  public readonly gateway: PaymentGateway = 'COD';
  public static readonly HIGH_VALUE_THRESHOLD = 50000; // Rs. 50,000 PKR

  public async createSession(order: Order, _idempotencyKey: string): Promise<PaymentSession> {
    const sessionId = `cod_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days delivery window

    return {
      id: sessionId,
      orderId: order.id,
      gateway: this.gateway,
      amount: order.total,
      currency: 'PKR',
      expiresAt,
      status: 'AUTHORIZED', // Pre-authorized on order creation
    };
  }

  public async authorize(payload: AuthorizePaymentPayload): Promise<PaymentTransaction> {
    const { orderId, amount, paymentDetails } = payload;

    // High value threshold check
    if (amount >= CodProvider.HIGH_VALUE_THRESHOLD && !paymentDetails.codVerified) {
      const error: any = new Error(
        `High-Value COD Alert: Orders exceeding Rs. ${CodProvider.HIGH_VALUE_THRESHOLD.toLocaleString()} require phone/OTP verification before dispatch.`
      );
      error.status = 400;
      throw error;
    }

    return {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId,
      gateway: this.gateway,
      status: 'AUTHORIZED',
      amount,
      currency: 'PKR',
      transactionReference: `COD-AUTH-${orderId}`,
      idempotencyKey: payload.sessionId,
      createdAt: new Date().toISOString(),
    };
  }

  public async capture(transactionId: string): Promise<PaymentTransaction> {
    return {
      id: transactionId,
      orderId: '',
      gateway: this.gateway,
      status: 'CAPTURED',
      amount: 0,
      currency: 'PKR',
      idempotencyKey: '',
      createdAt: new Date().toISOString(),
    };
  }

  public async refund(transaction: PaymentTransaction, amount?: number, reason?: string): Promise<PaymentTransaction> {
    const refundAmount = amount || transaction.amount;
    return {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId: transaction.orderId,
      gateway: this.gateway,
      status: 'REFUNDED',
      amount: refundAmount,
      currency: transaction.currency,
      transactionReference: `COD-REVERSAL-${transaction.id}`,
      idempotencyKey: `refund_${transaction.id}`,
      createdAt: new Date().toISOString(),
    };
  }

  public async handleWebhook(_headers: Record<string, string>, body: any): Promise<WebhookResult> {
    // Courier delivery reconciliation event
    const status = body.delivered ? 'CAPTURED' : 'FAILED';
    return {
      handled: true,
      orderId: body.orderId,
      transactionReference: body.trackingNumber,
      status,
      amount: body.amountCollected,
      currency: 'PKR',
      metadata: body,
    };
  }

  public verifySignature(_payload: any, _signature: string, _secret: string): boolean {
    return true; // Internal courier webhook
  }
}
