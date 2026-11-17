import { Router, Request, Response, NextFunction } from 'express';
import { b2bService } from './service.js';
import { B2BPaymentTerm, B2BRole } from '@platform/types';

export const b2bRouter = Router();

// ----------------------------------------------------------------------------
// Company Management Endpoints
// ----------------------------------------------------------------------------

/**
 * POST /api/v1/b2b/companies/register
 * Corporate company registration
 */
b2bRouter.post('/b2b/companies/register', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, ntnNumber, gstNumber, primaryUser } = req.body;
    if (!name || !ntnNumber || !primaryUser || !primaryUser.email) {
      return res.status(400).json({
        success: false,
        error: { message: 'name, ntnNumber, and primaryUser (email, name) are required.' },
      });
    }

    const company = b2bService.registerCompany({
      name,
      ntnNumber,
      gstNumber,
      primaryUser,
    });

    res.status(201).json({
      success: true,
      message: 'Company registered successfully. Status is PENDING_VERIFICATION.',
      data: company,
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
 * PATCH /api/v1/b2b/companies/:companyId/verify
 * Admin verifies corporate company, sets credit limit and payment terms
 */
b2bRouter.patch('/b2b/companies/:companyId/verify', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { creditLimit, paymentTerm } = req.body;
    if (creditLimit === undefined) {
      return res.status(400).json({
        success: false,
        error: { message: 'creditLimit is required.' },
      });
    }

    const company = b2bService.verifyCompany(
      req.params.companyId,
      parseFloat(creditLimit),
      paymentTerm as B2BPaymentTerm
    );

    res.status(200).json({
      success: true,
      message: 'Company verified successfully. Corporate credit line active.',
      data: company,
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
 * GET /api/v1/b2b/companies/:companyId
 * Get company profile, credit line and users
 */
b2bRouter.get('/b2b/companies/:companyId', (req: Request, res: Response) => {
  const company = b2bService.getCompany(req.params.companyId);
  if (!company) {
    return res.status(404).json({
      success: false,
      error: { message: `Company '${req.params.companyId}' not found.` },
    });
  }

  res.status(200).json({
    success: true,
    data: company,
  });
});

/**
 * POST /api/v1/b2b/companies/:companyId/users
 * Add employee user with role (PURCHASER / APPROVER / ADMIN)
 */
b2bRouter.post('/b2b/companies/:companyId/users', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, role } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        error: { message: 'name, email, and role (PURCHASER/APPROVER/ADMIN) are required.' },
      });
    }

    const updatedCompany = b2bService.addCompanyUser(req.params.companyId, {
      name,
      email,
      role: role as B2BRole,
    });

    res.status(201).json({
      success: true,
      message: `User '${email}' added with role '${role}'.`,
      data: updatedCompany,
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

// ----------------------------------------------------------------------------
// Wholesale Pricing & MOQ Endpoints
// ----------------------------------------------------------------------------

/**
 * POST /api/v1/b2b/pricing/calculate
 * Calculate wholesale volume pricing with MOQ enforcement
 */
b2bRouter.post('/b2b/pricing/calculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { variantId, quantity, companyId } = req.body;
    if (!variantId || !quantity) {
      return res.status(400).json({
        success: false,
        error: { message: 'variantId and quantity are required.' },
      });
    }

    const pricing = await b2bService.calculateWholesalePrice(
      variantId,
      parseInt(quantity, 10),
      companyId
    );

    res.status(200).json({
      success: true,
      data: pricing,
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

// ----------------------------------------------------------------------------
// RFQ (Request for Quotation) Endpoints
// ----------------------------------------------------------------------------

/**
 * POST /api/v1/b2b/rfq
 * Submit Request for Quotation
 */
b2bRouter.post('/b2b/rfq', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, submittedByEmail, items, notes } = req.body;
    if (!companyId || !submittedByEmail || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'companyId, submittedByEmail, and items array are required.' },
      });
    }

    const rfq = b2bService.createRFQ(companyId, submittedByEmail, items, notes);
    res.status(201).json({
      success: true,
      message: 'RFQ submitted successfully',
      data: rfq,
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
 * GET /api/v1/b2b/rfq/:rfqId
 * View RFQ details
 */
b2bRouter.get('/b2b/rfq/:rfqId', (req: Request, res: Response) => {
  const rfq = b2bService.getRFQ(req.params.rfqId);
  if (!rfq) {
    return res.status(404).json({
      success: false,
      error: { message: `RFQ '${req.params.rfqId}' not found.` },
    });
  }

  res.status(200).json({
    success: true,
    data: rfq,
  });
});

/**
 * POST /api/v1/b2b/rfq/:rfqId/quote
 * Seller/Admin issues custom quote and terms for RFQ
 */
b2bRouter.post('/b2b/rfq/:rfqId/quote', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { offeredItems, paymentTermOffered, adminQuoteNotes } = req.body;
    if (!offeredItems || !Array.isArray(offeredItems) || offeredItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'offeredItems array is required.' },
      });
    }

    const quotedRfq = b2bService.quoteRFQ(
      req.params.rfqId,
      offeredItems,
      paymentTermOffered as B2BPaymentTerm,
      adminQuoteNotes
    );

    res.status(200).json({
      success: true,
      message: 'Quote issued successfully for RFQ',
      data: quotedRfq,
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
 * POST /api/v1/b2b/rfq/:rfqId/accept
 * Corporate buyer approves quote and converts to order (Net 30 terms)
 */
b2bRouter.post('/b2b/rfq/:rfqId/accept', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approverEmail, shippingAddress } = req.body;
    if (!approverEmail) {
      return res.status(400).json({
        success: false,
        error: { message: 'approverEmail is required.' },
      });
    }

    const order = b2bService.acceptQuoteAndConvertToOrder(
      req.params.rfqId,
      approverEmail,
      shippingAddress
    );

    res.status(201).json({
      success: true,
      message: 'Quote accepted successfully. B2B Order generated.',
      data: order,
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
