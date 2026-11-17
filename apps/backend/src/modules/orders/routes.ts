import { Router, Request, Response, NextFunction } from 'express';
import { cartService } from '../cart/service.js';
import { orderStateMachineService } from './service.js';
import { OrderStatus } from '@platform/types';

export const ordersRouter = Router();

// ----------------------------------------------------------------------------
// Order State Machine & Lifecycle Routes
// ----------------------------------------------------------------------------

/**
 * GET /api/v1/orders
 * List all active orders
 */
ordersRouter.get('/orders', (_req: Request, res: Response) => {
  const orders = cartService.getAllOrders();
  res.status(200).json({
    success: true,
    data: orders,
  });
});

/**
 * GET /api/v1/orders/:orderNumber
 * Fetch specific order details by ID or Order Number
 */
ordersRouter.get('/orders/:orderNumber', (req: Request, res: Response) => {
  const order = cartService.getOrder(req.params.orderNumber);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: { message: `Order '${req.params.orderNumber}' not found.` },
    });
  }

  res.status(200).json({
    success: true,
    data: order,
  });
});

/**
 * PATCH /api/v1/orders/:orderNumber/status
 * Transition order through finite state machine
 */
ordersRouter.patch('/orders/:orderNumber/status', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, actor = 'ADMIN', notes } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        error: { message: 'status is required.' },
      });
    }

    const updatedOrder = orderStateMachineService.transitionOrder(
      req.params.orderNumber,
      status as OrderStatus,
      actor,
      notes
    );

    res.status(200).json({
      success: true,
      message: `Order transitioned to '${status}' successfully.`,
      data: updatedOrder,
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
 * GET /api/v1/orders/:orderNumber/events
 * Fetch immutable audit event ledger for an order
 */
ordersRouter.get('/orders/:orderNumber/events', (req: Request, res: Response) => {
  const events = orderStateMachineService.getOrderAuditHistory(req.params.orderNumber);
  res.status(200).json({
    success: true,
    data: events,
  });
});

// ----------------------------------------------------------------------------
// RMA (Returns & Refunds) Routes
// ----------------------------------------------------------------------------

/**
 * POST /api/v1/orders/:orderNumber/returns
 * Customer initiates a return request (only valid for DELIVERED orders)
 */
ordersRouter.post('/orders/:orderNumber/returns', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason, items } = req.body;
    if (!reason || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'reason and items array are required for return request.' },
      });
    }

    const returnRequest = orderStateMachineService.createReturnRequest(
      req.params.orderNumber,
      reason,
      items
    );

    res.status(201).json({
      success: true,
      message: 'Return request submitted successfully. Awaiting inspection.',
      data: returnRequest,
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
 * GET /api/v1/orders/returns/:returnId
 * Get RMA details
 */
ordersRouter.get('/orders/returns/:returnId', (req: Request, res: Response) => {
  const rma = orderStateMachineService.getReturn(req.params.returnId);
  if (!rma) {
    return res.status(404).json({
      success: false,
      error: { message: `Return request '${req.params.returnId}' not found.` },
    });
  }

  res.status(200).json({
    success: true,
    data: rma,
  });
});

/**
 * POST /api/v1/orders/returns/:returnId/decision
 * Admin approves or rejects return request
 */
ordersRouter.post('/orders/returns/:returnId/decision', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decision, adminNotes } = req.body;
    if (!decision || (decision !== 'APPROVED' && decision !== 'REJECTED')) {
      return res.status(400).json({
        success: false,
        error: { message: "decision must be either 'APPROVED' or 'REJECTED'." },
      });
    }

    const rma = orderStateMachineService.processReturnRequest(
      req.params.returnId,
      decision,
      adminNotes
    );

    res.status(200).json({
      success: true,
      message: `Return request marked as ${decision}.`,
      data: rma,
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
