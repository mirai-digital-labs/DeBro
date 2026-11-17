import {
  Company,
  CompanyStatus,
  CompanyUser,
  B2BRole,
  B2BPaymentTerm,
  WholesalePricingTier,
  RFQ,
  RFQItem,
  RFQStatus,
  Order,
  OrderStatus,
  CustomerAddress,
} from '@platform/types';
import { catalogService } from '../catalog/service.js';
import { cartService } from '../cart/service.js';
import { marketplaceService } from '../marketplace/service.js';

export interface RegisterCompanyPayload {
  name: string;
  ntnNumber: string;
  gstNumber?: string;
  primaryUser: {
    name: string;
    email: string;
    role: B2BRole;
  };
}

export class B2BService {
  private companies: Map<string, Company> = new Map();
  private rfqs: Map<string, RFQ> = new Map();
  private rfqSequence = 1000;
  private b2bOrderSequence = 5000;

  constructor() {
    this.seedVerifiedB2BCompany();
  }

  private seedVerifiedB2BCompany() {
    const companyId = 'comp_systems_pk';
    const now = new Date().toISOString();

    const company: Company = {
      id: companyId,
      name: 'Systems Pakistan Technologies Ltd',
      ntnNumber: '1122334-9',
      gstNumber: 'GST-998877',
      creditLimit: 5000000, // Rs. 5,000,000 Credit Limit
      usedCredit: 0,
      availableCredit: 5000000,
      paymentTerm: 'NET_30',
      status: 'ACTIVE',
      users: [
        {
          id: 'user_sys_purchaser',
          name: 'Hamza Shaikh',
          email: 'hamza.procurement@systemspk.com',
          role: 'PURCHASER',
        },
        {
          id: 'user_sys_approver',
          name: 'Bilal Farooq (VP Procurement)',
          email: 'bilal.farooq@systemspk.com',
          role: 'APPROVER',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.companies.set(companyId, company);
  }

  // --------------------------------------------------------------------------
  // 1. Company Onboarding & Organizational Hierarchy
  // --------------------------------------------------------------------------
  public registerCompany(payload: RegisterCompanyPayload): Company {
    const companyId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const company: Company = {
      id: companyId,
      name: payload.name,
      ntnNumber: payload.ntnNumber,
      gstNumber: payload.gstNumber,
      creditLimit: 0,
      usedCredit: 0,
      availableCredit: 0,
      paymentTerm: 'PREPAID',
      status: 'PENDING_VERIFICATION',
      users: [
        {
          id: `u_${Date.now()}_1`,
          email: payload.primaryUser.email,
          name: payload.primaryUser.name,
          role: payload.primaryUser.role || 'ADMIN',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.companies.set(companyId, company);
    return company;
  }

  public verifyCompany(
    companyId: string,
    creditLimit: number,
    paymentTerm: B2BPaymentTerm = 'NET_30'
  ): Company {
    const company = this.companies.get(companyId);
    if (!company) {
      const error: any = new Error(`Company '${companyId}' not found.`);
      error.status = 404;
      throw error;
    }

    company.status = 'ACTIVE';
    company.creditLimit = creditLimit;
    company.availableCredit = creditLimit - company.usedCredit;
    company.paymentTerm = paymentTerm;
    company.updatedAt = new Date().toISOString();

    this.companies.set(companyId, company);
    return company;
  }

  public addCompanyUser(companyId: string, user: { name: string; email: string; role: B2BRole }): Company {
    const company = this.companies.get(companyId);
    if (!company) {
      const error: any = new Error(`Company '${companyId}' not found.`);
      error.status = 404;
      throw error;
    }

    const newUser: CompanyUser = {
      id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    company.users.push(newUser);
    company.updatedAt = new Date().toISOString();
    this.companies.set(companyId, company);
    return company;
  }

  public getCompany(companyId: string): Company | null {
    return this.companies.get(companyId) || null;
  }

  // --------------------------------------------------------------------------
  // 2. Wholesale Pricing Tiers & Minimum Order Quantity (MOQ)
  // --------------------------------------------------------------------------
  public async calculateWholesalePrice(variantId: string, quantity: number, companyId?: string) {
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than zero.');
    }

    // Lookup variant in catalog
    const allProducts = (await catalogService.getProducts({ limit: 100 })).items;
    let foundVariant = null;
    let foundProduct = null;

    for (const prod of allProducts) {
      const v = prod.variants.find((variant) => variant.id === variantId || variant.sku === variantId);
      if (v) {
        foundVariant = v;
        foundProduct = prod;
        break;
      }
    }

    if (!foundVariant || !foundProduct) {
      const error: any = new Error(`Variant '${variantId}' not found.`);
      error.status = 404;
      throw error;
    }

    // Minimum Order Quantity (MOQ) Enforcement for B2B
    // If MOQ is configured (or test item threshold e.g. 10 for wholesale)
    const effectiveMoq = foundVariant.moq ?? (foundProduct.categoryId === 'cat_fashion_apparel' ? 10 : 2);
    if (quantity < effectiveMoq) {
      const error: any = new Error(
        `Minimum Order Quantity (MOQ) Violation: Variant '${foundVariant.title}' requires a minimum of ${effectiveMoq} units for wholesale pricing. Requested: ${quantity}.`
      );
      error.status = 400;
      throw error;
    }

    // Tiered Volume Discounts
    // Tier 1: 10-49 units -> 10% discount
    // Tier 2: 50+ units -> 20% discount
    let discountPercent = 0;
    if (quantity >= 50) {
      discountPercent = 20;
    } else if (quantity >= 10) {
      discountPercent = 10;
    }

    const basePrice = foundVariant.price;
    const discountedUnitPrice = Math.round(basePrice * (1 - discountPercent / 100));
    const totalPrice = discountedUnitPrice * quantity;

    return {
      variantId: foundVariant.id,
      productTitle: foundProduct.title,
      variantTitle: foundVariant.title,
      sku: foundVariant.sku,
      quantity,
      moq: effectiveMoq,
      baseUnitPrice: basePrice,
      discountPercent,
      wholesaleUnitPrice: discountedUnitPrice,
      totalPrice,
      currency: 'PKR',
    };
  }

  // --------------------------------------------------------------------------
  // 3. Request for Quotation (RFQ) Negotiation Engine
  // --------------------------------------------------------------------------
  public createRFQ(
    companyId: string,
    submittedByEmail: string,
    items: Array<{ variantId: string; quantity: number; targetUnitPrice?: number }>,
    notes?: string
  ): RFQ {
    const company = this.companies.get(companyId);
    if (!company) {
      const error: any = new Error(`Company '${companyId}' not found.`);
      error.status = 404;
      throw error;
    }

    // Verify submitter belongs to company
    const user = company.users.find((u) => u.email.toLowerCase() === submittedByEmail.toLowerCase());
    if (!user) {
      const error: any = new Error(`User '${submittedByEmail}' is not associated with '${company.name}'.`);
      error.status = 403;
      throw error;
    }

    this.rfqSequence++;
    const rfqNumber = `RFQ-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${this.rfqSequence}`;
    const rfqId = `rfq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const rfq: RFQ = {
      id: rfqId,
      rfqNumber,
      companyId: company.id,
      companyName: company.name,
      submittedByEmail,
      items: items.map((i) => ({
        variantId: i.variantId,
        sku: `SKU-${i.variantId}`,
        productTitle: 'Enterprise Commercial Supply',
        quantity: i.quantity,
        targetUnitPrice: i.targetUnitPrice,
      })),
      notes,
      status: 'SUBMITTED',
      createdAt: now,
      updatedAt: now,
    };

    this.rfqs.set(rfqId, rfq);
    return rfq;
  }

  public quoteRFQ(
    rfqId: string,
    offeredItems: Array<{ variantId: string; offeredUnitPrice: number }>,
    paymentTermOffered: B2BPaymentTerm = 'NET_30',
    adminQuoteNotes?: string
  ): RFQ {
    const rfq = this.rfqs.get(rfqId);
    if (!rfq) {
      const error: any = new Error(`RFQ '${rfqId}' not found.`);
      error.status = 404;
      throw error;
    }

    let quotedTotal = 0;
    for (const item of rfq.items) {
      const quote = offeredItems.find((o) => o.variantId === item.variantId);
      if (quote) {
        item.offeredUnitPrice = quote.offeredUnitPrice;
        quotedTotal += quote.offeredUnitPrice * item.quantity;
      }
    }

    rfq.quotedTotal = quotedTotal;
    rfq.paymentTermOffered = paymentTermOffered;
    rfq.adminQuoteNotes = adminQuoteNotes;
    rfq.status = 'QUOTED';
    rfq.validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days validity
    rfq.updatedAt = new Date().toISOString();

    this.rfqs.set(rfqId, rfq);
    return rfq;
  }

  public acceptQuoteAndConvertToOrder(
    rfqId: string,
    approverEmail: string,
    shippingAddress?: CustomerAddress
  ): Order {
    const rfq = this.rfqs.get(rfqId);
    if (!rfq) {
      const error: any = new Error(`RFQ '${rfqId}' not found.`);
      error.status = 404;
      throw error;
    }

    if (rfq.status !== 'QUOTED') {
      const error: any = new Error(`Cannot accept RFQ in status '${rfq.status}'. RFQ must be in 'QUOTED' status.`);
      error.status = 400;
      throw error;
    }

    const company = this.companies.get(rfq.companyId);
    if (!company) {
      const error: any = new Error(`Company '${rfq.companyId}' not found.`);
      error.status = 404;
      throw error;
    }

    // Role-Based Authorization: Only APPROVER or ADMIN can sign off quotes
    const user = company.users.find((u) => u.email.toLowerCase() === approverEmail.toLowerCase());
    if (!user || (user.role !== 'APPROVER' && user.role !== 'ADMIN')) {
      const error: any = new Error(
        `Authorization Denied: User '${approverEmail}' with role '${user?.role || 'NONE'}' cannot accept corporate quotes. Requires 'APPROVER' or 'ADMIN' authority.`
      );
      error.status = 403;
      throw error;
    }

    // Credit Check for Net 15/30/60
    const orderTotal = rfq.quotedTotal || 0;
    if (company.paymentTerm !== 'PREPAID') {
      if (company.availableCredit < orderTotal) {
        const error: any = new Error(
          `Corporate Credit Limit Exceeded: Order value of Rs. ${orderTotal.toLocaleString()} exceeds available company credit of Rs. ${company.availableCredit.toLocaleString()}.`
        );
        error.status = 400;
        throw error;
      }

      // Deduct from available credit
      company.availableCredit -= orderTotal;
      company.usedCredit += orderTotal;
      company.updatedAt = new Date().toISOString();
      this.companies.set(company.id, company);
    }

    this.b2bOrderSequence++;
    const orderNumber = `ORD-B2B-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${this.b2bOrderSequence}`;
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const defaultAddress: CustomerAddress = shippingAddress || {
      firstName: company.name,
      lastName: 'Corporate Supply',
      phone: '03001234567',
      addressLine1: 'Plot 45-B, Commercial Industrial Zone',
      city: 'Lahore',
      postalCode: '54000',
      countryCode: 'PK',
    };

    const order: Order = {
      id: orderId,
      orderNumber,
      customerId: company.id,
      customerEmail: approverEmail,
      customerPhone: '03001234567',
      currency: 'PKR',
      subtotal: orderTotal,
      taxTotal: 0,
      shippingTotal: 0, // Complimentary B2B corporate logistics
      discountTotal: 0,
      total: orderTotal,
      orderStatus: 'CONFIRMED',
      shippingAddress: defaultAddress,
      billingAddress: defaultAddress,
      items: rfq.items.map((item) => ({
        id: `oi_${Math.random().toString(36).substring(2, 7)}`,
        orderId,
        variantId: item.variantId,
        productTitle: item.productTitle,
        variantTitle: `B2B Volume Wholesale (${item.quantity} Units)`,
        sku: item.sku,
        unitPrice: item.offeredUnitPrice || 0,
        quantity: item.quantity,
        total: (item.offeredUnitPrice || 0) * item.quantity,
      })),
      createdAt: now,
      updatedAt: now,
    };

    // Split for multi-vendor if needed
    marketplaceService.splitOrderIntoSubOrders(order);

    // Save Order into main Cart/Order registry
    (cartService as any).orders.set(order.id, order);

    // Update RFQ
    rfq.status = 'CONVERTED_TO_ORDER';
    rfq.convertedOrderId = order.orderNumber;
    rfq.updatedAt = now;
    this.rfqs.set(rfq.id, rfq);

    return order;
  }

  public getRFQ(rfqId: string): RFQ | null {
    return this.rfqs.get(rfqId) || null;
  }

  public getCompanyRFQs(companyId: string): RFQ[] {
    return Array.from(this.rfqs.values()).filter((r) => r.companyId === companyId);
  }
}

// Singleton Service Instance
export const b2bService = new B2BService();
