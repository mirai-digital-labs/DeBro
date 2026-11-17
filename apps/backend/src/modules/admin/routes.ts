import { Router, Request, Response, NextFunction } from 'express';
import { adminService } from './service.js';

export const adminRouter = Router();

// ----------------------------------------------------------------------------
// 1. Executive Dashboard Metrics
// ----------------------------------------------------------------------------
adminRouter.get('/admin/dashboard/metrics', (_req: Request, res: Response) => {
  const metrics = adminService.getExecutiveMetrics();
  res.status(200).json({
    success: true,
    data: metrics,
  });
});

// ----------------------------------------------------------------------------
// 2. CMS Banner Management
// ----------------------------------------------------------------------------
adminRouter.get('/admin/cms/banners', (req: Request, res: Response) => {
  const placement = req.query.placement as string | undefined;
  const activeOnly = req.query.activeOnly !== 'false';
  const banners = adminService.getBanners(placement, activeOnly);
  res.status(200).json({
    success: true,
    data: {
      count: banners.length,
      banners,
    },
  });
});

adminRouter.post('/admin/cms/banners', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, subtitle, imageUrl, targetUrl, placement, displayOrder, isActive } = req.body;
    if (!title || !imageUrl || !targetUrl || !placement) {
      return res.status(400).json({
        success: false,
        error: { message: 'title, imageUrl, targetUrl, and placement are required fields.' },
      });
    }

    const banner = adminService.createBanner({
      title,
      subtitle,
      imageUrl,
      targetUrl,
      placement,
      displayOrder: displayOrder || 1,
      isActive: isActive !== false,
    });

    res.status(201).json({
      success: true,
      message: 'CMS Banner created successfully.',
      data: banner,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/admin/cms/banners/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const banner = adminService.updateBanner(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Banner updated successfully.',
      data: banner,
    });
  } catch (err: any) {
    res.status(404).json({
      success: false,
      error: { message: err.message },
    });
  }
});

adminRouter.delete('/admin/cms/banners/:id', (req: Request, res: Response) => {
  const deleted = adminService.deleteBanner(req.params.id);
  res.status(200).json({
    success: deleted,
    message: deleted ? 'Banner deleted.' : 'Banner not found.',
  });
});

// ----------------------------------------------------------------------------
// 3. Marketing & Promotions Engine
// ----------------------------------------------------------------------------
adminRouter.get('/admin/promotions/coupons', (_req: Request, res: Response) => {
  const coupons = adminService.getAllCoupons();
  res.status(200).json({
    success: true,
    data: {
      count: coupons.length,
      coupons,
    },
  });
});

adminRouter.post('/admin/promotions/coupons', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, discountType, discountValue, minOrderAmount, maxDiscountAmount, usageLimit, isActive } =
      req.body;
    if (!code || !discountType || typeof discountValue !== 'number') {
      return res.status(400).json({
        success: false,
        error: { message: 'code, discountType, and discountValue are required.' },
      });
    }

    const coupon = adminService.createCoupon({
      code,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      isActive: isActive !== false,
    });

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully.',
      data: coupon,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { message: err.message },
    });
  }
});

adminRouter.post('/admin/promotions/validate-coupon', (req: Request, res: Response) => {
  const { code, cartTotal } = req.body;
  if (!code || typeof cartTotal !== 'number') {
    return res.status(400).json({
      success: false,
      error: { message: 'code and cartTotal (number) are required.' },
    });
  }

  const result = adminService.validateCoupon(code, cartTotal);
  res.status(200).json({
    success: result.valid,
    data: result,
  });
});

adminRouter.post('/admin/promotions/redeem-coupon', (req: Request, res: Response) => {
  const { code, cartTotal } = req.body;
  if (!code || typeof cartTotal !== 'number') {
    return res.status(400).json({
      success: false,
      error: { message: 'code and cartTotal (number) are required.' },
    });
  }

  const result = adminService.redeemCoupon(code, cartTotal);
  res.status(200).json({
    success: result.valid,
    data: result,
  });
});

// ----------------------------------------------------------------------------
// 4. SEO & Schema.org JSON-LD Structured Data
// ----------------------------------------------------------------------------
adminRouter.get('/seo/product/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const meta = await adminService.generateProductSEO(req.params.slug);
    res.status(200).json({
      success: true,
      data: meta,
    });
  } catch (err: any) {
    res.status(404).json({
      success: false,
      error: { message: err.message },
    });
  }
});

adminRouter.get('/seo/sitemap.xml', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const xml = await adminService.generateSitemapXml();
    res.header('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (err) {
    next(err);
  }
});
