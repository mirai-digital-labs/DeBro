import { Order, OrderStatus } from '@platform/types';
import { cartService } from '../cart/service.js';

export interface OrderEvent {
  id: string;
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  actor: 'CUSTOMER' | 'SYSTEM' | 'ADMIN' | 'COURIER';
  notes?: string;
  timestamp: string;
}

export type ReturnStatus = 'REQUESTED' | 'INSPECTION_PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED';

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  reason: string;
  items: Array<{ sku: string; quantity: number }>;
  status: ReturnStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export class OrderStateMachineService {
  private events: Map<string, OrderEvent[]> = new Map();
  private returns: Map<string, ReturnRequest> = new Map();

  // Formal Finite State Machine Matrix
  private validTransitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING_PAYMENT: ['PAID', 'CONFIRMED', 'CANCELLED'],
    PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'SHIPPED'], // Re-attempt delivery
    DELIVERED: ['REFUNDED'], // Customer can request return
    CANCELLED: [],
    REFUNDED: [],
  };

  // --------------------------------------------------------------------------
  // State Machine Transitions
  // --------------------------------------------------------------------------
  public transitionOrder(
    orderIdOrNumber: string,
    newStatus: OrderStatus,
    actor: 'CUSTOMER' | 'SYSTEM' | 'ADMIN' | 'COURIER',
    notes?: string
  ): Order {
    const order = cartService.getOrder(orderIdOrNumber);
    if (!order) {
      const error: any = new Error(`Order '${orderIdOrNumber}' not found.`);
      error.status = 404;
      throw error;
    }

    const currentStatus = order.orderStatus;

    if (currentStatus === newStatus) {
      return order; // Idempotent
    }

    const allowed = this.validTransitions[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      const error: any = new Error(
        `State Machine Violation: Cannot transition order '${order.orderNumber}' from '${currentStatus}' to '${newStatus}'. Allowed next states: [${(allowed || []).join(', ')}]`
      );
      error.status = 400;
      throw error;
    }

    // Apply state change
    order.orderStatus = newStatus;
    order.updatedAt = new Date().toISOString();

    // Log immutable audit event
    const event: OrderEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId: order.id,
      fromStatus: currentStatus,
      toStatus: newStatus,
      actor,
      notes: notes || `Order transitioned from ${currentStatus} to ${newStatus}`,
      timestamp: new Date().toISOString(),
    };

    const orderEvents = this.events.get(order.id) || [];
    orderEvents.push(event);
    this.events.set(order.id, orderEvents);

    return order;
  }

  public getOrderAuditHistory(orderIdOrNumber: string): OrderEvent[] {
    const order = cartService.getOrder(orderIdOrNumber);
    if (!order) return [];
    return this.events.get(order.id) || [];
  }

  // --------------------------------------------------------------------------
  // Returns & Refunds (RMA Engine)
  // --------------------------------------------------------------------------
  public createReturnRequest(
    orderIdOrNumber: string,
    reason: string,
    items: Array<{ sku: string; quantity: number }>
  ): ReturnRequest {
    const order = cartService.getOrder(orderIdOrNumber);
    if (!order) {
      const error: any = new Error(`Order '${orderIdOrNumber}' not found.`);
      error.status = 404;
      throw error;
    }

    // Return eligibility rule: Order must be in DELIVERED status
    if (order.orderStatus !== 'DELIVERED') {
      const error: any = new Error(
        `Order '${order.orderNumber}' is not eligible for return. Current status is '${order.orderStatus}'. Only 'DELIVERED' orders can be returned.`
      );
      error.status = 400;
      throw error;
    }

    const returnId = `rma_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const returnRequest: ReturnRequest = {
      id: returnId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      reason,
      items,
      status: 'REQUESTED',
      createdAt: now,
      updatedAt: now,
    };

    this.returns.set(returnId, returnRequest);

    // Record audit event on the order
    this.recordExternalEvent(order.id, 'CUSTOMER', `Return requested (RMA ID: ${returnId}). Reason: ${reason}`);

    return returnRequest;
  }

  public processReturnRequest(
    returnId: string,
    decision: 'APPROVED' | 'REJECTED',
    adminNotes?: string
  ): ReturnRequest {
    const rma = this.returns.get(returnId);
    if (!rma) {
      const error: any = new Error(`Return request '${returnId}' not found.`);
      error.status = 404;
      throw error;
    }

    rma.status = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    rma.adminNotes = adminNotes;
    rma.updatedAt = new Date().toISOString();

    this.returns.set(returnId, rma);

    if (decision === 'APPROVED') {
      // Transition order to REFUNDED
      this.transitionOrder(rma.orderId, 'REFUNDED', 'ADMIN', `Return approved (RMA: ${rma.id}). Refund authorized.`);
    }

    return rma;
  }

  public getReturn(returnId: string): ReturnRequest | null {
    return this.returns.get(returnId) || null;
  }

  private recordExternalEvent(orderId: string, actor: any, notes: string) {
    const order = cartService.getOrder(orderId);
    if (!order) return;

    const event: OrderEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderId: order.id,
      fromStatus: order.orderStatus,
      toStatus: order.orderStatus,
      actor,
      notes,
      timestamp: new Date().toISOString(),
    };

    const orderEvents = this.events.get(order.id) || [];
    orderEvents.push(event);
    this.events.set(order.id, orderEvents);
  }
}

// Singleton Service Instance
export const orderStateMachineService = new OrderStateMachineService();
