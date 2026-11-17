import crypto from 'crypto';
import { Order, PaymentGateway, PaymentStatus, PaymentTransaction, PaymentSession } from '@platform/types';
import { IPaymentProvider, AuthorizePaymentPayload, WebhookResult } from '../interfaces.js';

export class EasypaisaProvider implements IPaymentProvider {
  public readonly gateway: PaymentGateway = 'EASYPAISA';
  private storeId: string;
  private hashKey: string;

  constructor() {
    this.storeId = process.env.EASYPAISA_STORE_ID || 'EP_STORE_101';
    this.hashKey = process.env.EASYPAISA_HASH_KEY || 'ep_hash_secret_54321';
  }

  public async createSession(order: Order, _idempotencyKey: string): Promise<PaymentSession> {
    const sessionId = `ep_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    return {
      id: sessionId,
      orderId: order.id,
      gateway: this.gateway,
      amount: order.total,
      currency: 'PKR',
      redirectUrl: `https://easypaystg.easypaisa.com.pk/easypay/Index.jsf?orderRefNum=${order.orderNumber}&storeId=${this.storeId}`,
      expiresAt,
      status: 'PENDING',
    };
  }

  public async authorize(payload: AuthorizePaymentPayload): Promise<PaymentTransaction> {
    const { orderId, amount, paymentDetails } = payload;

    const mobile = (paymentDetails.mobileNumber || '').replace(/[\s-]/g, '');
    if (!/^(\+92|0)?3[0-9]{9}$/.test(mobile)) {
      const error: any = new Error(`Easypaisa Error: Invalid mobile number '${paymentDetails.mobileNumber}'.`);
      error.status = 400;
      throw error;
    }

    const txnRefNo = `EP-${Date.now()}`;
    const now = new Date().toISOString();

    return {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId,
      gateway: this.gateway,
      status: 'CAPTURED',
      amount,
      currency: 'PKR',
      transactionReference: txnRefNo,
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
      currency: 'PKR',
      idempotencyKey: '',
      createdAt: new Date().toISOString(),
    };
  }

  public async refund(transaction: PaymentTransaction, amount?: number, reason?: string): Promise<PaymentTransaction> {
    const refundAmount = amount || transaction.amount;
    const refundRef = `EP-REF-${Date.now()}`;

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
    const signature = headers['x-easypaisa-signature'] || body.checksum;
    if (!signature) {
      const error: any = new Error('Easypaisa Webhook: Missing checksum signature.');
      error.status = 401;
      throw error;
    }

    const isValid = this.verifySignature(body, signature, this.hashKey);
    if (!isValid) {
      const error: any = new Error('Easypaisa Webhook: Checksum verification failed.');
      error.status = 401;
      throw error;
    }

    const status = body.responseCode === '0000' ? 'CAPTURED' : 'FAILED';

    return {
      handled: true,
      orderId: body.orderRefNum || body.orderId,
      transactionReference: body.transactionId || body.transactionReference,
      status,
      amount: parseFloat(body.amount) || 0,
      currency: 'PKR',
      metadata: body,
    };
  }

  public verifySignature(payload: any, signature: string, secret: string): boolean {
    const expected = this.calculateChecksum(payload, secret);
    const bufExpected = Buffer.from(expected);
    const bufSig = Buffer.from(signature);
    if (bufExpected.length !== bufSig.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufExpected, bufSig);
  }

  public calculateChecksum(payload: any, secret: string): string {
    const keys = Object.keys(payload)
      .filter((k) => k !== 'checksum' && payload[k] !== undefined && payload[k] !== null && payload[k] !== '')
      .sort();

    const data = keys.map((k) => `${k}=${payload[k]}`).join('&');
    return crypto.createHmac('sha256', secret || this.hashKey).update(data).digest('hex');
  }
}
