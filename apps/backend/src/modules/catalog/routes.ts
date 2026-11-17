import { Router, Request, Response, NextFunction } from 'express';
import { catalogService, ProductFilterQuery } from './service.js';

export const catalogRouter = Router();

// ----------------------------------------------------------------------------
// Category Endpoints
// ----------------------------------------------------------------------------

/**
 * GET /api/v1/categories
 * Returns active categories with their dynamic attributes and options
 */
catalogRouter.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await catalogService.getCategories();
    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/categories/:idOrSlug
 */
catalogRouter.get('/categories/:idOrSlug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await catalogService.getCategoryByIdOrSlug(req.params.idOrSlug);
    if (!category) {
      return res.status(404).json({
        success: false,
        error: { message: `Category '${req.params.idOrSlug}' not found` },
      });
    }
    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------------------------------
// Product Endpoints
// ----------------------------------------------------------------------------

/**
 * GET /api/v1/products
 * Faceted query engine supporting dynamic category attributes
 */
catalogRouter.get('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query: ProductFilterQuery = {
      categoryId: req.query.categoryId as string,
      categorySlug: req.query.categorySlug as string,
      brand: req.query.brand as string,
      search: req.query.search as string,
      sortBy: req.query.sortBy as any,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    if (req.query.minPrice) query.minPrice = parseFloat(req.query.minPrice as string);
    if (req.query.maxPrice) query.maxPrice = parseFloat(req.query.maxPrice as string);

    // Extract dynamic attribute filters prefixed with "attr_" e.g. "attr_ram_gb=16GB"
    const attributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (key.startsWith('attr_')) {
        const attributeCode = key.replace('attr_', '');
        attributes[attributeCode] = String(value);
      }
    }
    if (Object.keys(attributes).length > 0) {
      query.attributes = attributes;
    }

    const result = await catalogService.getProducts(query);
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/products/:idOrSlug
 */
catalogRouter.get('/products/:idOrSlug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await catalogService.getProductByIdOrSlug(req.params.idOrSlug);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { message: `Product '${req.params.idOrSlug}' not found` },
      });
    }
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/products
 * Creates a product with dynamic category-attribute validation
 */
catalogRouter.post('/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await catalogService.createProduct(req.body);
    res.status(201).json({
      success: true,
      message: 'Product created and validated against category schema successfully',
      data: product,
    });
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: {
          message: err.message,
          details: err.details,
        },
      });
    }
    next(err);
  }
});

/**
 * PATCH /api/v1/products/:id/status
 * Product lifecycle transition (DRAFT -> PENDING_REVIEW -> PUBLISHED)
 */
catalogRouter.patch('/products/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        error: { message: 'status field is required in request body' },
      });
    }
    const updated = await catalogService.updateProductStatus(req.params.id, status);
    res.status(200).json({
      success: true,
      message: `Product lifecycle status transitioned to '${status}'`,
      data: updated,
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
