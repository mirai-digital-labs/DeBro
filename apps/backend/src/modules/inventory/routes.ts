import { Router, Request, Response, NextFunction } from 'express';
import { inventoryService } from './service.js';

export const inventoryRouter = Router();

// ----------------------------------------------------------------------------
// Inventory & Warehouse Routes
// ----------------------------------------------------------------------------

/**
 * GET /api/v1/inventory/warehouses
 * List all active fulfillment hubs/warehouses
 */
inventoryRouter.get('/inventory/warehouses', (_req: Request, res: Response) => {
  const warehouses = inventoryService.getWarehouses();
  res.status(200).json({
    success: true,
    data: warehouses,
  });
});

/**
 * GET /api/v1/inventory/stock/:variantId
 * Get available stock and multi-warehouse breakdown for a variant
 */
inventoryRouter.get('/inventory/stock/:variantId', (req: Request, res: Response) => {
  const { variantId } = req.params;
  const available = inventoryService.getAvailableStock(variantId);
  const breakdown = inventoryService.getStockBreakdown(variantId);

  res.status(200).json({
    success: true,
    data: {
      variantId,
      availableStock: available,
      locations: breakdown,
    },
  });
});

/**
 * POST /api/v1/inventory/reserve
 * Phase 1 Stock Reservation (during checkout with 15-min TTL)
 */
inventoryRouter.post('/inventory/reserve', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cartId, variantId, quantity, ttlMinutes } = req.body;
    if (!cartId || !variantId || !quantity) {
      return res.status(400).json({
        success: false,
        error: { message: 'cartId, variantId, and quantity are required.' },
      });
    }

    const reservation = inventoryService.reserveStock(
      cartId,
      variantId,
      parseInt(quantity, 10),
      ttlMinutes ? parseInt(ttlMinutes, 10) : 15
    );

    res.status(201).json({
      success: true,
      message: 'Stock reserved successfully',
      data: reservation,
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
 * POST /api/v1/inventory/release
 * Rollback reservation on checkout cancellation
 */
inventoryRouter.post('/inventory/release', (req: Request, res: Response) => {
  const { cartId } = req.body;
  if (!cartId) {
    return res.status(400).json({
      success: false,
      error: { message: 'cartId is required.' },
    });
  }

  inventoryService.releaseReservation(cartId);
  res.status(200).json({
    success: true,
    message: `Reservations for cart '${cartId}' released successfully`,
  });
});

/**
 * POST /api/v1/inventory/commit
 * Commit stock permanently after order placement
 */
inventoryRouter.post('/inventory/commit', (req: Request, res: Response) => {
  const { cartId } = req.body;
  if (!cartId) {
    return res.status(400).json({
      success: false,
      error: { message: 'cartId is required.' },
    });
  }

  inventoryService.commitStock(cartId);
  res.status(200).json({
    success: true,
    message: `Stock committed permanently for cart '${cartId}'`,
  });
});

/**
 * POST /api/v1/inventory/cleanup-expired
 * Trigger manual or cron-based TTL cleanup
 */
inventoryRouter.post('/inventory/cleanup-expired', (_req: Request, res: Response) => {
  const released = inventoryService.cleanupExpiredReservations();
  res.status(200).json({
    success: true,
    message: `Released ${released} units from expired reservations.`,
    data: { releasedCount: released },
  });
});
