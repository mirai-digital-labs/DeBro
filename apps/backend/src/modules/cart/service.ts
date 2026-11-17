import { Cart, CartItem, CustomerAddress, Order, OrderStatus, PaymentGateway } from '@platform/types';
import { catalogService } from '../catalog/service.js';
import { inventoryService } from '../inventory/service.js';
import { marketplaceService } from '../marketplace/service.js';

export interface CartCheckoutPayload {
  customerEmail: string;
  customerPhone: string;
  shippingAddress: CustomerAddress;
  billingAddress?: CustomerAddress;
  paymentGateway: PaymentGateway;
  notes?: string;
}

export class CartService {
  private carts: Map<string, Cart> = new Map();
  private orders: Map<string, Order> = new Map();
  private orderSequence = 1000;

  // --------------------------------------------------------------------------
  // Cart Lifecycle
  // --------------------------------------------------------------------------
  public createCart(customerId?: string): Cart {
    const cartId = `cart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newCart: Cart = {
      id: cartId,
      customerId: customerId || null,
      items: [],
      subtotal: 0,
      shippingTotal: 250, // Standard delivery flat fee in PKR
      taxTotal: 0,
      discountTotal: 0,
      total: 250,
      currency: 'PKR',
    };
    this.carts.set(cartId, newCart);
    return newCart;
  }

  public getCart(cartId: string): Cart {
    const cart = this.carts.get(cartId);
    if (!cart) {
      const error: any = new Error(`Cart with ID '${cartId}' not found.`);
      error.status = 404;
      throw error;
    }
    return this.recalculateTotals(cart);
  }

  // --------------------------------------------------------------------------
  // Line Items Operations
  // --------------------------------------------------------------------------
  public async addItem(cartId: string, variantId: string, quantity: number = 1): Promise<Cart> {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0.');
    }

    const cart = this.getCart(cartId);

    // Locate product & variant in catalog
    const allProducts = (await catalogService.getProducts({ limit: 100 })).items;
    let foundProduct = null;
    let foundVariant = null;

    for (const prod of allProducts) {
      const variant = prod.variants.find((v) => v.id === variantId || v.sku === variantId);
      if (variant) {
        foundProduct = prod;
        foundVariant = variant;
        break;
      }
    }

    if (!foundProduct || !foundVariant) {
      const error: any = new Error(`Variant '${variantId}' not found in active catalog.`);
      error.status = 404;
      throw error;
    }

    // Check inventory stock availability
    if (foundVariant.inventoryQuantity !== undefined && foundVariant.inventoryQuantity < quantity) {
      const error: any = new Error(
        `Insufficient stock for '${foundVariant.title}'. Only ${foundVariant.inventoryQuantity} units available.`
      );
      error.status = 400;
      throw error;
    }

    // Check if item already exists in cart
    const existingIndex = cart.items.findIndex((item) => item.variantId === foundVariant!.id);

    if (existingIndex > -1) {
      const updatedQty = cart.items[existingIndex].quantity + quantity;
      cart.items[existingIndex].quantity = updatedQty;
      cart.items[existingIndex].totalPrice = updatedQty * foundVariant.price;
    } else {
      const newItem: CartItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        cartId: cart.id,
        variantId: foundVariant.id,
        product: foundProduct,
        variant: foundVariant,
        quantity,
        unitPrice: foundVariant.price,
        totalPrice: quantity * foundVariant.price,
      };
      cart.items.push(newItem);
    }

    this.recalculateTotals(cart);
    this.carts.set(cartId, cart);
    return cart;
  }

  public updateItem(cartId: string, itemId: string, quantity: number): Cart {
    const cart = this.getCart(cartId);
    const itemIndex = cart.items.findIndex((item) => item.id === itemId);

    if (itemIndex === -1) {
      const error: any = new Error(`Cart item '${itemId}' not found.`);
      error.status = 404;
      throw error;
    }

    if (quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].totalPrice = quantity * cart.items[itemIndex].unitPrice;
    }

    this.recalculateTotals(cart);
    this.carts.set(cartId, cart);
    return cart;
  }

  public removeItem(cartId: string, itemId: string): Cart {
    const cart = this.getCart(cartId);
    cart.items = cart.items.filter((item) => item.id !== itemId);
    this.recalculateTotals(cart);
    this.carts.set(cartId, cart);
    return cart;
  }

  // --------------------------------------------------------------------------
  // Financial Math & Pakistan Delivery Rules
  // --------------------------------------------------------------------------
  private recalculateTotals(cart: Cart): Cart {
    const subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    // Pakistan Rule: Orders above Rs. 2,999 qualify for FREE delivery
    let shippingTotal = 250; // Standard TCS/Leopards shipping
    if (subtotal >= 2999 || cart.items.length === 0) {
      shippingTotal = 0;
    }

    const total = Math.max(0, subtotal + shippingTotal + cart.taxTotal - cart.discountTotal);

    cart.subtotal = subtotal;
    cart.shippingTotal = shippingTotal;
    cart.total = total;

    return cart;
  }

  // --------------------------------------------------------------------------
  // Checkout & Order Creation
  // --------------------------------------------------------------------------
  public checkout(cartId: string, payload: CartCheckoutPayload): Order {
    const cart = this.getCart(cartId);

    if (cart.items.length === 0) {
      const error: any = new Error('Cannot checkout an empty shopping cart.');
      error.status = 400;
      throw error;
    }

    // Validate phone number format (Pakistan standard: 03XX or +923XX)
    const phoneClean = payload.customerPhone.replace(/[\s-]/g, '');
    const pkPhoneRegex = /^(\+92|0)?3[0-9]{9}$/;
    if (!pkPhoneRegex.test(phoneClean)) {
      const error: any = new Error(
        `Invalid Pakistani phone number: '${payload.customerPhone}'. Must be format 03XXXXXXXXX or +923XXXXXXXXX.`
      );
      error.status = 400;
      throw error;
    }

    // Two-Phase Concurrency-Safe Stock Reservation
    try {
      for (const item of cart.items) {
        inventoryService.reserveStock(cart.id, item.variantId, item.quantity);
      }
    } catch (err: any) {
      inventoryService.releaseReservation(cart.id);
      throw err;
    }

    this.orderSequence++;
    const orderNumber = `ORD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${this.orderSequence}`;
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const order: Order = {
      id: orderId,
      orderNumber,
      customerId: cart.customerId,
      customerEmail: payload.customerEmail,
      customerPhone: phoneClean,
      currency: cart.currency,
      subtotal: cart.subtotal,
      taxTotal: cart.taxTotal,
      shippingTotal: cart.shippingTotal,
      discountTotal: cart.discountTotal,
      total: cart.total,
      orderStatus: payload.paymentGateway === 'COD' ? 'CONFIRMED' as OrderStatus : 'PENDING_PAYMENT',
      shippingAddress: payload.shippingAddress,
      billingAddress: payload.billingAddress || payload.shippingAddress,
      items: cart.items.map((item) => {
        const sellerId = item.product.sellerId || (item.product.id.includes('think') ? 'seller_lahore_tech' : (item.product.id.includes('oxford') ? 'seller_karachi_apparel' : 'seller_platform_default'));
        const sellerStoreName = sellerId === 'seller_lahore_tech' ? 'Lahore Tech Hub' : (sellerId === 'seller_karachi_apparel' ? 'Karachi Luxury Apparel' : 'NexStore Official');
        return {
          id: `oi_${Math.random().toString(36).substring(2, 7)}`,
          orderId,
          variantId: item.variantId,
          sellerId,
          sellerStoreName,
          productTitle: item.product.title,
          variantTitle: item.variant.title,
          sku: item.variant.sku,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          total: item.totalPrice,
        };
      }),
      createdAt: now,
      updatedAt: now,
    };

    // Multi-Vendor Marketplace: Split into sub-orders per vendor
    marketplaceService.splitOrderIntoSubOrders(order);

    // Permanently commit reserved stock on successful order placement
    inventoryService.commitStock(cart.id);

    // Store Order & Flush Cart
    this.orders.set(order.id, order);
    this.carts.delete(cartId);

    return order;
  }

  public getOrder(orderIdOrNumber: string): Order | null {
    for (const order of this.orders.values()) {
      if (order.id === orderIdOrNumber || order.orderNumber === orderIdOrNumber) {
        return order;
      }
    }
    return null;
  }

  public getAllOrders(): Order[] {
    return Array.from(this.orders.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

// Singleton Service Instance
export const cartService = new CartService();
