import { Seller, SellerStatus, SellerKYC, SubOrder, Order, OrderItem, OrderStatus } from '@platform/types';
import { cartService } from '../cart/service.js';

export interface RegisterSellerPayload {
  storeName: string;
  email: string;
  phone: string;
  kyc: {
    businessName: string;
    ntnNumber?: string;
    cnicNumber: string;
    bankName: string;
    accountTitle: string;
    iban: string;
    city: string;
  };
  commissionRatePercent?: number;
}

export class MarketplaceService {
  private sellers: Map<string, Seller> = new Map();
  // Key: subOrderId, Value: SubOrder
  private subOrders: Map<string, SubOrder> = new Map();

  constructor() {
    this.seedDefaultSellers();
  }

  private seedDefaultSellers() {
    // 1. Official Platform Flagship Store
    this.createSellerDirect({
      id: 'seller_platform_default',
      storeName: 'NexStore Official',
      slug: 'nexstore-official',
      email: 'flagship@nexstore.pk',
      phone: '03000000000',
      status: 'ACTIVE',
      commissionRatePercent: 0,
      kyc: {
        businessName: 'NexStore E-Commerce Platforms Pvt Ltd',
        ntnNumber: '9988776-1',
        cnicNumber: '42201-1234567-1',
        bankName: 'Habib Bank Limited (HBL)',
        accountTitle: 'NexStore Operating Account',
        iban: 'PK36HABB0000123456789012',
        city: 'Karachi',
        isVerified: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Verified Tech Seller in Lahore
    this.createSellerDirect({
      id: 'seller_lahore_tech',
      storeName: 'Lahore Tech Hub',
      slug: 'lahore-tech-hub',
      email: 'sales@lahoretechhub.pk',
      phone: '03019876543',
      status: 'ACTIVE',
      commissionRatePercent: 5, // 5% commission on electronics
      kyc: {
        businessName: 'Lahore Computing & Electronics Traders',
        ntnNumber: '1234567-8',
        cnicNumber: '35202-9876543-1',
        bankName: 'Meezan Bank Limited',
        accountTitle: 'Lahore Tech Traders',
        iban: 'PK12MEZN0000987654321012',
        city: 'Lahore',
        isVerified: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 3. Verified Apparel Seller in Karachi
    this.createSellerDirect({
      id: 'seller_karachi_apparel',
      storeName: 'Karachi Luxury Apparel',
      slug: 'karachi-luxury-apparel',
      email: 'contact@karachiapparel.pk',
      phone: '03211234567',
      status: 'ACTIVE',
      commissionRatePercent: 10, // 10% commission on fashion
      kyc: {
        businessName: 'Karachi Textiles & Apparel Mills',
        ntnNumber: '7654321-9',
        cnicNumber: '42101-7654321-3',
        bankName: 'Bank Alfalah',
        accountTitle: 'Karachi Luxury Apparel',
        iban: 'PK45ALFH0000765432109876',
        city: 'Karachi',
        isVerified: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  private createSellerDirect(seller: Seller): Seller {
    this.sellers.set(seller.id, seller);
    return seller;
  }

  // --------------------------------------------------------------------------
  // 1. Seller Onboarding & KYC
  // --------------------------------------------------------------------------
  public registerSeller(payload: RegisterSellerPayload): Seller {
    // Validate email uniqueness
    for (const s of this.sellers.values()) {
      if (s.email.toLowerCase() === payload.email.toLowerCase()) {
        const error: any = new Error(`Seller with email '${payload.email}' already exists.`);
        error.status = 409;
        throw error;
      }
    }

    const sellerId = `seller_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const slug = payload.storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const now = new Date().toISOString();

    const newSeller: Seller = {
      id: sellerId,
      storeName: payload.storeName,
      slug,
      email: payload.email,
      phone: payload.phone,
      status: 'PENDING_APPROVAL',
      commissionRatePercent: payload.commissionRatePercent ?? 8, // Standard 8% default
      kyc: {
        ...payload.kyc,
        isVerified: false,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.sellers.set(sellerId, newSeller);
    return newSeller;
  }

  public reviewSellerKyc(sellerId: string, decision: 'APPROVE' | 'REJECT', _adminNotes?: string): Seller {
    const seller = this.sellers.get(sellerId);
    if (!seller) {
      const error: any = new Error(`Seller '${sellerId}' not found.`);
      error.status = 404;
      throw error;
    }

    if (decision === 'APPROVE') {
      seller.status = 'ACTIVE';
      seller.kyc.isVerified = true;
    } else {
      seller.status = 'REJECTED';
      seller.kyc.isVerified = false;
    }

    seller.updatedAt = new Date().toISOString();
    this.sellers.set(sellerId, seller);
    return seller;
  }

  public getSeller(sellerIdOrSlug: string): Seller | null {
    for (const s of this.sellers.values()) {
      if (s.id === sellerIdOrSlug || s.slug === sellerIdOrSlug) {
        return s;
      }
    }
    return null;
  }

  public getAllSellers(status?: SellerStatus): Seller[] {
    const all = Array.from(this.sellers.values());
    if (status) {
      return all.filter((s) => s.status === status);
    }
    return all;
  }

  // --------------------------------------------------------------------------
  // 2. Multi-Seller Order Splitting Engine
  // --------------------------------------------------------------------------
  /**
   * Splits a multi-vendor parent order into isolated sub-orders per vendor.
   * Calculates platform commission and net payable for each seller.
   */
  public splitOrderIntoSubOrders(order: Order): SubOrder[] {
    // Group line items by sellerId
    const itemsBySeller: Map<string, OrderItem[]> = new Map();

    for (const item of order.items) {
      const sellerId = item.sellerId || 'seller_platform_default';
      const list = itemsBySeller.get(sellerId) || [];
      list.push(item);
      itemsBySeller.set(sellerId, list);
    }

    const createdSubOrders: SubOrder[] = [];
    let index = 1;

    for (const [sellerId, sellerItems] of itemsBySeller.entries()) {
      const seller = this.sellers.get(sellerId) || {
        storeName: 'Verified Marketplace Partner',
        commissionRatePercent: 8,
      } as Seller;

      const subtotal = sellerItems.reduce((sum, item) => sum + item.total, 0);
      // Flat shipping allocation (first seller gets delivery fee, or proportional)
      const shippingTotal = index === 1 ? order.shippingTotal : 0;
      const taxTotal = 0;
      const total = subtotal + shippingTotal + taxTotal;

      // Calculate commission & net payout
      const commissionRate = seller.commissionRatePercent / 100;
      const platformCommission = Math.round(subtotal * commissionRate);
      const sellerPayout = total - platformCommission;

      const subOrderNumber = `${order.orderNumber}-S${index}`;
      const subOrderId = `sub_${order.id}_${sellerId}_${index}`;
      const now = new Date().toISOString();

      const subOrder: SubOrder = {
        id: subOrderId,
        parentOrderId: order.id,
        parentOrderNumber: order.orderNumber,
        subOrderNumber,
        sellerId,
        sellerStoreName: seller.storeName,
        items: sellerItems,
        subtotal,
        shippingTotal,
        taxTotal,
        total,
        platformCommission,
        sellerPayout,
        orderStatus: order.orderStatus,
        createdAt: now,
        updatedAt: now,
      };

      this.subOrders.set(subOrderId, subOrder);
      createdSubOrders.push(subOrder);
      index++;
    }

    order.subOrders = createdSubOrders;
    return createdSubOrders;
  }

  // --------------------------------------------------------------------------
  // 3. Tenant Data Isolation & RBAC
  // --------------------------------------------------------------------------
  /**
   * Strict Tenant Isolation: A seller can only query their own sub-orders.
   */
  public getSellerOrders(sellerId: string): SubOrder[] {
    return Array.from(this.subOrders.values()).filter((so) => so.sellerId === sellerId);
  }

  public getSubOrder(subOrderId: string): SubOrder | null {
    return this.subOrders.get(subOrderId) || null;
  }

  /**
   * Fulfillment status update with authorization barrier.
   */
  public updateSubOrderStatus(
    subOrderId: string,
    sellerId: string,
    newStatus: OrderStatus,
    trackingNumber?: string
  ): SubOrder {
    const subOrder = this.subOrders.get(subOrderId);
    if (!subOrder) {
      const error: any = new Error(`Sub-order '${subOrderId}' not found.`);
      error.status = 404;
      throw error;
    }

    // RBAC Check: Ensure requesting seller owns this sub-order
    if (subOrder.sellerId !== sellerId) {
      const error: any = new Error(
        `Access Denied (Tenant Isolation): Seller '${sellerId}' cannot modify Sub-order '${subOrderId}' owned by '${subOrder.sellerId}'.`
      );
      error.status = 403;
      throw error;
    }

    subOrder.orderStatus = newStatus;
    if (trackingNumber) {
      subOrder.trackingNumber = trackingNumber;
    }
    subOrder.updatedAt = new Date().toISOString();

    this.subOrders.set(subOrderId, subOrder);
    return subOrder;
  }

  // --------------------------------------------------------------------------
  // 4. Marketplace Commission & Payout Ledger
  // --------------------------------------------------------------------------
  public getSellerEarnings(sellerId: string) {
    const seller = this.sellers.get(sellerId);
    if (!seller) {
      const error: any = new Error(`Seller '${sellerId}' not found.`);
      error.status = 404;
      throw error;
    }

    const sellerOrders = this.getSellerOrders(sellerId);
    const grossSales = sellerOrders.reduce((sum, so) => sum + so.subtotal, 0);
    const totalCommission = sellerOrders.reduce((sum, so) => sum + so.platformCommission, 0);
    const netPayout = sellerOrders.reduce((sum, so) => sum + so.sellerPayout, 0);

    return {
      sellerId,
      storeName: seller.storeName,
      commissionRatePercent: seller.commissionRatePercent,
      totalOrders: sellerOrders.length,
      grossSales,
      totalCommissionDeducted: totalCommission,
      netPayoutPayable: netPayout,
      currency: 'PKR',
    };
  }
}

// Singleton Service Instance
export const marketplaceService = new MarketplaceService();
