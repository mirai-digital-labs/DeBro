import { Router, Request, Response, NextFunction } from 'express';
import { cartService } from './service.js';

export const cartRouter = Router();

// ----------------------------------------------------------------------------
// Cart Endpoints
// ----------------------------------------------------------------------------

/**
 * POST /api/v1/cart
 * Create a new guest or customer shopping cart
 */
cartRouter.post('/cart', (req: Request, res: Response) => {
  const { customerId } = req.body;
  const cart = cartService.createCart(customerId);
  res.status(201).json({
    success: true,
    message: 'Shopping cart created',
    data: cart,
  });
});

/**
 * GET /api/v1/cart/:cartId
 * Fetch cart details with live calculated financial totals
 */
cartRouter.get('/cart/:cartId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const cart = cartService.getCart(req.params.cartId);
    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/cart/:cartId/items
 * Add product variant line item to cart
 */
cartRouter.post('/cart/:cartId/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { variantId, quantity } = req.body;
    if (!variantId) {
      return res.status(400).json({
        success: false,
        error: { message: 'variantId is required' },
      });
    }
    const updatedCart = await cartService.addItem(
      req.params.cartId,
      variantId,
      quantity ? parseInt(quantity, 10) : 1
    );
    res.status(200).json({
      success: true,
      message: 'Item added to shopping cart',
      data: updatedCart,
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
 * PATCH /api/v1/cart/:cartId/items/:itemId
 * Update quantity of a line item
 */
cartRouter.patch('/cart/:cartId/items/:itemId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quantity } = req.body;
    if (quantity === undefined) {
      return res.status(400).json({
        success: false,
        error: { message: 'quantity is required' },
      });
    }
    const updatedCart = cartService.updateItem(
      req.params.cartId,
      req.params.itemId,
      parseInt(quantity, 10)
    );
    res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: updatedCart,
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
 * DELETE /api/v1/cart/:cartId/items/:itemId
 * Remove line item from cart
 */
cartRouter.delete('/cart/:cartId/items/:itemId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const updatedCart = cartService.removeItem(req.params.cartId, req.params.itemId);
    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: updatedCart,
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
// Checkout & Order Endpoints
// ----------------------------------------------------------------------------

/**
 * POST /api/v1/cart/:cartId/checkout
 * Converts cart to confirmed/pending Order with address and payment details
 */
cartRouter.post('/cart/:cartId/checkout', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerEmail, customerPhone, shippingAddress, billingAddress, paymentGateway, notes } = req.body;

    if (!customerEmail || !customerPhone || !shippingAddress || !paymentGateway) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required checkout fields (customerEmail, customerPhone, shippingAddress, paymentGateway)',
        },
      });
    }

    const order = cartService.checkout(req.params.cartId, {
      customerEmail,
      customerPhone,
      shippingAddress,
      billingAddress,
      paymentGateway,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
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

/**
 * GET /api/v1/orders/:idOrNumber
 * Retrieve placed order details and tracking status
 */
cartRouter.get('/orders/:idOrNumber', (req: Request, res: Response) => {
  const order = cartService.getOrder(req.params.idOrNumber);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: { message: `Order '${req.params.idOrNumber}' not found` },
    });
  }
  res.status(200).json({
    success: true,
    data: order,
  });
});
