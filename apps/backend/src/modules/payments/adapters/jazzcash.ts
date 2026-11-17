import crypto from 'crypto';
import { Order, PaymentGateway, PaymentStatus, PaymentTransaction, PaymentSession } from '@platform/types';
import { IPaymentProvider, AuthorizePaymentPayload, WebhookResult } from '../interfaces.js';

export class JazzCashProvider implements IPaymentProvider {
  public readonly gateway: PaymentGateway = 'JAZZCASH';
  private merchantId: string;
  private password: string;
  private integritySalt: string;

  constructor() {
    this.merchantId = process.env.JAZZCASH_MERCHANT_ID || 'MC12345_SANDBOX';
    this.password = process.env.JAZZCASH_PASSWORD || 'sandbox_pass';
    this.integritySalt = process.env.JAZZCASH_INTEGRITY_SALT || 'salt_secret_key_12345';
  }

  public async createSession(order: Order, _idempotencyKey: string): Promise<PaymentSession> {
    const sessionId = `jzc_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    return {
      id: sessionId,
      orderId: order.id,
      gateway: this.gateway,
      amount: order.total,
      currency: 'PKR',
      redirectUrl: `https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform?pp_TxnRefNo=${order.orderNumber}`,
      expiresAt,
      status: 'PENDING',
    };
  }

  public async authorize(payload: AuthorizePaymentPayload): Promise<PaymentTransaction> {
    const { orderId, amount, paymentDetails } = payload;

    // Validate Pakistani mobile wallet format
    const mobile = (paymentDetails.mobileNumber || '').replace(/[\s-]/g, '');
    if (!/^(\+92|0)?3[0-9]{9}$/.test(mobile)) {
      const error: any = new Error(`JazzCash Error: Invalid mobile wallet number '${paymentDetails.mobileNumber}'.`);
      error.status = 400;
      throw error;
    }

    const txnRefNo = `JC-${Date.now()}`;
    const now = new Date().toISOString();

    return {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId,
      gateway: this.gateway,
      status: 'CAPTURED', // JazzCash Mobile Wallet captures in real-time
      amount,
      currency: 'PKR',
      transactionReference: txnRefNo,
      idempotencyKey: payload.sessionId,
      createdAt: now,
    };
  }

  public async capture(transactionId: string): Promise<PaymentTransaction> {
    // JazzCash captures automatically on authorization
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
    const refundRef = `JC-REF-${Date.now()}`;

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
    const signature = headers['x-jazzcash-signature'] || body.pp_SecureHash;
    if (!signature) {
      const error: any = new Error('JazzCash Webhook: Missing secure signature hash.');
      error.status = 401;
      throw error;
    }

    const isValid = this.verifySignature(body, signature, this.integritySalt);
    if (!isValid) {
      const error: any = new Error('JazzCash Webhook: HMAC signature mismatch / verification failed.');
      error.status = 401;
      throw error;
    }

    const responseCode = body.pp_ResponseCode;
    const isSuccess = responseCode === '000' || responseCode === '121';

    return {
      handled: true,
      orderId: body.pp_BillReference || body.orderId,
      transactionReference: body.pp_TxnRefNo || body.transactionReference,
      status: isSuccess ? 'CAPTURED' : 'FAILED',
      amount: parseFloat(body.pp_Amount) || 0,
      currency: 'PKR',
      metadata: body,
    };
  }

  public verifySignature(payload: any, signature: string, secret: string): boolean {
    const expected = this.calculateHmac(payload, secret);
    const bufExpected = Buffer.from(expected);
    const bufSig = Buffer.from(signature);
    if (bufExpected.length !== bufSig.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufExpected, bufSig);
  }

  public calculateHmac(payload: any, secret: string): string {
    // Standard JazzCash sorted string calculation
    const keys = Object.keys(payload)
      .filter((k) => k !== 'pp_SecureHash' && payload[k] !== undefined && payload[k] !== null && payload[k] !== '')
      .sort();

    const stringToHash = keys.map((k) => `${k}=${payload[k]}`).join('&');
    const hmac = crypto.createHmac('sha256', secret || this.integritySalt);
    hmac.update(stringToHash);
    return hmac.digest('hex');
  }
}
