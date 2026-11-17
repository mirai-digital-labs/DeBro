import { Router, Request, Response, NextFunction } from 'express';
import { paymentService } from './service.js';
import { PaymentGateway } from '@platform/types';

export const paymentsRouter = Router();

// ----------------------------------------------------------------------------
// Payment Routes
// ----------------------------------------------------------------------------

/**
 * POST /api/v1/payments/initiate
 * Initiate a checkout payment session (JazzCash, Easypaisa, Stripe, COD)
 */
paymentsRouter.post('/payments/initiate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, gateway, idempotencyKey } = req.body;
    if (!orderId || !gateway) {
      return res.status(400).json({
        success: false,
        error: { message: 'orderId and gateway are required.' },
      });
    }

    const session = await paymentService.createSession(
      orderId,
      gateway as PaymentGateway,
      idempotencyKey
    );

    res.status(201).json({
      success: true,
      message: `Payment session initiated for ${gateway}`,
      data: session,
    });
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: { message: err.message },
      });
    }
    next(err);
  }
});

/**
 * POST /api/v1/payments/confirm
 * Authorize & capture payment transaction (Idempotency protected)
 */
paymentsRouter.post('/payments/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, paymentDetails, idempotencyKey } = req.body;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'sessionId is required.' },
      });
    }

    const transaction = await paymentService.authorizePayment(
      sessionId,
      paymentDetails || {},
      idempotencyKey
    );

    res.status(200).json({
      success: true,
      message: `Payment confirmed successfully (${transaction.status})`,
      data: transaction,
    });
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: { message: err.message },
      });
    }
    next(err);
  }
});

/**
 * POST /api/v1/payments/webhooks/:gateway
 * Ingest provider webhooks with HMAC-SHA256 signature verification & replay protection
 */
paymentsRouter.post('/payments/webhooks/:gateway', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gateway = req.params.gateway.toUpperCase() as PaymentGateway;
    const headers = req.headers as Record<string, string>;
    const body = req.body;

    const result = await paymentService.processWebhook(gateway, headers, body);

    res.status(200).json({
      success: true,
      message: `Webhook processed for ${gateway}`,
      data: result,
    });
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: { message: err.message },
      });
    }
    next(err);
  }
});

/**
 * POST /api/v1/payments/refund
 * Refund payment transaction
 */
paymentsRouter.post('/payments/refund', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId, amount, reason } = req.body;
    if (!transactionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'transactionId is required.' },
      });
    }

    const refund = await paymentService.refundPayment(
      transactionId,
      amount ? parseFloat(amount) : undefined,
      reason
    );

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: refund,
    });
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: { message: err.message },
      });
    }
    next(err);
  }
});

/**
 * GET /api/v1/payments/transactions/:id
 * Lookup payment transaction by ID
 */
paymentsRouter.get('/payments/transactions/:id', (req: Request, res: Response) => {
  const tx = paymentService.getTransaction(req.params.id);
  if (!tx) {
    return res.status(404).json({
      success: false,
      error: { message: `Transaction '${req.params.id}' not found.` },
    });
  }

  res.status(200).json({
    success: true,
    data: tx,
  });
});

/**
 * GET /api/v1/payments/orders/:orderId
 * Fetch all payment records for an order
 */
paymentsRouter.get('/payments/orders/:orderId', (req: Request, res: Response) => {
  const transactions = paymentService.getOrderTransactions(req.params.orderId);
  res.status(200).json({
    success: true,
    data: transactions,
  });
});
