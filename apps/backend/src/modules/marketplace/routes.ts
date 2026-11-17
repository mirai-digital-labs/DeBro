import { Router, Request, Response, NextFunction } from 'express';
import { marketplaceService } from './service.js';
import { cartService } from '../cart/service.js';
import { SellerStatus, OrderStatus } from '@platform/types';

export const marketplaceRouter = Router();

// ----------------------------------------------------------------------------
// Seller Onboarding & KYC Endpoints
// ----------------------------------------------------------------------------

/**
 * POST /api/v1/marketplace/sellers/register
 * New seller registration and KYC submission
 */
marketplaceRouter.post('/marketplace/sellers/register', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storeName, email, phone, kyc, commissionRatePercent } = req.body;
    if (!storeName || !email || !phone || !kyc || !kyc.cnicNumber || !kyc.iban) {
      return res.status(400).json({
        success: false,
        error: { message: 'storeName, email, phone, and complete KYC (CNIC, Bank IBAN) are required.' },
      });
    }

    const seller = marketplaceService.registerSeller({
      storeName,
      email,
      phone,
      kyc,
      commissionRatePercent,
    });

    res.status(201).json({
      success: true,
      message: 'Seller registration submitted successfully. Status is PENDING_APPROVAL.',
      data: seller,
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
 * PATCH /api/v1/marketplace/sellers/:sellerId/kyc-review
 * Admin reviews and approves/rejects seller KYC
 */
marketplaceRouter.patch('/marketplace/sellers/:sellerId/kyc-review', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decision, adminNotes } = req.body;
    if (!decision || (decision !== 'APPROVE' && decision !== 'REJECT')) {
      return res.status(400).json({
        success: false,
        error: { message: "decision must be either 'APPROVE' or 'REJECT'." },
      });
    }

    const updatedSeller = marketplaceService.reviewSellerKyc(req.params.sellerId, decision, adminNotes);
    res.status(200).json({
      success: true,
      message: `Seller marked as ${updatedSeller.status}`,
      data: updatedSeller,
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
 * GET /api/v1/marketplace/sellers
 * List sellers (public/admin)
 */
marketplaceRouter.get('/marketplace/sellers', (req: Request, res: Response) => {
  const status = req.query.status as SellerStatus | undefined;
  const sellers = marketplaceService.getAllSellers(status);
  res.status(200).json({
    success: true,
    data: sellers,
  });
});

/**
 * GET /api/v1/marketplace/sellers/:sellerId
 * Get seller details
 */
marketplaceRouter.get('/marketplace/sellers/:sellerId', (req: Request, res: Response) => {
  const seller = marketplaceService.getSeller(req.params.sellerId);
  if (!seller) {
    return res.status(404).json({
      success: false,
      error: { message: `Seller '${req.params.sellerId}' not found.` },
    });
  }

  res.status(200).json({
    success: true,
    data: seller,
  });
});

// ----------------------------------------------------------------------------
// Tenant-Isolated Seller Subsystem & Orders
// ----------------------------------------------------------------------------

/**
 * GET /api/v1/marketplace/sellers/:sellerId/orders
 * Tenant Data Isolation: Fetch only the sub-orders belonging to this seller
 */
marketplaceRouter.get('/marketplace/sellers/:sellerId/orders', (req: Request, res: Response) => {
  const seller = marketplaceService.getSeller(req.params.sellerId);
  if (!seller) {
    return res.status(404).json({
      success: false,
      error: { message: `Seller '${req.params.sellerId}' not found.` },
    });
  }

  const orders = marketplaceService.getSellerOrders(req.params.sellerId);
  res.status(200).json({
    success: true,
    data: orders,
  });
});

/**
 * PATCH /api/v1/marketplace/sellers/:sellerId/sub-orders/:subOrderId/status
 * Seller fulfills their specific sub-order with tracking number (RBAC checked)
 */
marketplaceRouter.patch(
  '/marketplace/sellers/:sellerId/sub-orders/:subOrderId/status',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, trackingNumber } = req.body;
      if (!status) {
        return res.status(400).json({
          success: false,
          error: { message: 'status is required.' },
        });
      }

      const updatedSubOrder = marketplaceService.updateSubOrderStatus(
        req.params.subOrderId,
        req.params.sellerId,
        status as OrderStatus,
        trackingNumber
      );

      res.status(200).json({
        success: true,
        message: `Sub-order transitioned to '${status}' successfully.`,
        data: updatedSubOrder,
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
  }
);

/**
 * GET /api/v1/marketplace/sellers/:sellerId/earnings
 * Seller Payout & Commission Ledger
 */
marketplaceRouter.get('/marketplace/sellers/:sellerId/earnings', (req: Request, res: Response, next: NextFunction) => {
  try {
    const earnings = marketplaceService.getSellerEarnings(req.params.sellerId);
    res.status(200).json({
      success: true,
      data: earnings,
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
 * GET /api/v1/marketplace/orders/:orderNumber/sub-orders
 * View parent order's split sub-orders
 */
marketplaceRouter.get('/marketplace/orders/:orderNumber/sub-orders', (req: Request, res: Response) => {
  const order = cartService.getOrder(req.params.orderNumber);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: { message: `Order '${req.params.orderNumber}' not found.` },
    });
  }

  res.status(200).json({
    success: true,
    data: order.subOrders || [],
  });
});
