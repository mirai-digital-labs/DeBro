import { Order, PaymentGateway, PaymentStatus, PaymentTransaction, PaymentSession } from '@platform/types';

export interface AuthorizePaymentPayload {
  sessionId: string;
  orderId: string;
  gateway: PaymentGateway;
  amount: number;
  currency: string;
  paymentDetails: {
    // JazzCash / Easypaisa
    mobileNumber?: string;
    mpin?: string;
    cnicLast6?: string;

    // Card / Stripe
    cardToken?: string;
    paymentMethodId?: string;

    // COD
    codVerified?: boolean;
    verificationNotes?: string;
  };
}

export interface WebhookResult {
  handled: boolean;
  orderId?: string;
  transactionReference?: string;
  status: PaymentStatus;
  amount?: number;
  currency?: string;
  metadata?: Record<string, any>;
}

export interface IPaymentProvider {
  readonly gateway: PaymentGateway;

  /**
   * Create an initiated payment session with provider
   */
  createSession(order: Order, idempotencyKey: string): Promise<PaymentSession>;

  /**
   * Authorize / Execute payment
   */
  authorize(payload: AuthorizePaymentPayload): Promise<PaymentTransaction>;

  /**
   * Capture authorized payment
   */
  capture(transactionId: string): Promise<PaymentTransaction>;

  /**
   * Refund full or partial payment
   */
  refund(transaction: PaymentTransaction, amount?: number, reason?: string): Promise<PaymentTransaction>;

  /**
   * Verify and process incoming provider webhook
   */
  handleWebhook(headers: Record<string, string>, body: any): Promise<WebhookResult>;

  /**
   * Verify digital signature (HMAC-SHA256)
   */
  verifySignature(payload: any, signature: string, secret: string): boolean;
}
