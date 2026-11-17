/**
 * Universal Commerce Domain Types
 * @package @platform/types
 */

// ============================================================================
// 1. DYNAMIC CATALOG & ATTRIBUTES
// ============================================================================

export type AttributeType = 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN' | 'DATE';

export interface AttributeOption {
  id: string;
  attributeId: string;
  value: string;
  displayLabel: string;
  colorHex?: string;
  displayOrder: number;
}

export interface CategoryAttribute {
  id: string;
  categoryId: string;
  code: string;
  label: string;
  type: AttributeType;
  unit?: string;
  isRequired: boolean;
  isFilterable: boolean;
  isVariantDefining: boolean;
  validationRegex?: string;
  displayOrder: number;
  options?: AttributeOption[];
}

export interface Category {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  bannerUrl?: string;
  isActive: boolean;
  attributes?: CategoryAttribute[];
  children?: Category[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 2. UNIVERSAL PRODUCT & VARIANTS
// ============================================================================

export type ProductStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type ProductType = 'PHYSICAL' | 'DIGITAL' | 'SERVICE';

export interface ProductImage {
  id: string;
  productId: string;
  variantId?: string | null;
  url: string;
  altText?: string;
  isThumbnail: boolean;
  displayOrder: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode?: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  weightGrams?: number;
  variantAttributes: Record<string, string | number | boolean>;
  images?: ProductImage[];
  inventoryQuantity?: number;
  moq?: number;
  wholesaleTiers?: WholesalePricingTier[];
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  categoryId: string;
  sellerId?: string;
  title: string;
  slug: string;
  brand?: string;
  shortDescription?: string;
  description?: string;
  productType: ProductType;
  status: ProductStatus;
  attributesJson: Record<string, any>;
  variants: ProductVariant[];
  images: ProductImage[];
  category?: Category;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 3. CONCURRENCY-SAFE INVENTORY & RESERVATIONS
// ============================================================================

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  isActive: boolean;
}

export interface InventoryLevel {
  id: string;
  variantId: string;
  warehouseId: string;
  stockedQuantity: number;
  reservedQuantity: number;
  availableQuantity: number; // stockedQuantity - reservedQuantity
}

export interface StockReservation {
  id: string;
  variantId: string;
  warehouseId: string;
  cartId: string;
  quantity: number;
  expiresAt: string;
  createdAt: string;
}

// ============================================================================
// 7. MULTI-VENDOR MARKETPLACE & SELLERS
// ============================================================================

export type SellerStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export interface SellerKYC {
  businessName: string;
  ntnNumber?: string;
  cnicNumber: string;
  bankName: string;
  accountTitle: string;
  iban: string;
  city: string;
  isVerified: boolean;
}

export interface Seller {
  id: string;
  storeName: string;
  slug: string;
  email: string;
  phone: string;
  status: SellerStatus;
  commissionRatePercent: number; // e.g. 8 for 8%
  kyc: SellerKYC;
  createdAt: string;
  updatedAt: string;
}

export interface SubOrder {
  id: string;
  parentOrderId: string;
  parentOrderNumber: string;
  subOrderNumber: string;
  sellerId: string;
  sellerStoreName: string;
  items: OrderItem[];
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  platformCommission: number;
  sellerPayout: number;
  orderStatus: OrderStatus;
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 4. CART, ORDERS & PAYMENTS (Pakistan First)
// ============================================================================

export interface CartItem {
  id: string;
  cartId: string;
  variantId: string;
  product: Product;
  variant: ProductVariant;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Cart {
  id: string;
  customerId?: string | null;
  items: CartItem[];
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  currency: string;
}

export interface CustomerAddress {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province?: string;
  postalCode?: string;
  countryCode: string; // 'PK'
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentGateway = 'COD' | 'JAZZCASH' | 'EASYPAISA' | 'STRIPE';
export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';

export interface OrderItem {
  id: string;
  orderId: string;
  variantId?: string | null;
  sellerId?: string;
  sellerStoreName?: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  customerEmail: string;
  customerPhone: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
  orderStatus: OrderStatus;
  shippingAddress: CustomerAddress;
  billingAddress: CustomerAddress;
  items: OrderItem[];
  subOrders?: SubOrder[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  gateway: PaymentGateway;
  status: PaymentStatus;
  amount: number;
  currency: string;
  transactionReference?: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface PaymentSession {
  id: string;
  orderId: string;
  gateway: PaymentGateway;
  amount: number;
  currency: string;
  clientSecret?: string;
  redirectUrl?: string;
  expiresAt: string;
  status: PaymentStatus;
}

// ============================================================================
// 8. B2B WHOLESALE COMMERCE & RFQ ENGINE
// ============================================================================

export type B2BRole = 'PURCHASER' | 'APPROVER' | 'ADMIN';
export type B2BPaymentTerm = 'NET_15' | 'NET_30' | 'NET_60' | 'PREPAID';
export type CompanyStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'CREDIT_HOLD' | 'SUSPENDED';

export interface WholesalePricingTier {
  minQuantity: number;
  maxQuantity?: number;
  unitPrice: number;
  discountPercentage?: number;
}

export interface CompanyUser {
  id: string;
  email: string;
  name: string;
  role: B2BRole;
}

export interface Company {
  id: string;
  name: string;
  ntnNumber: string;
  gstNumber?: string;
  creditLimit: number;
  usedCredit: number;
  availableCredit: number;
  paymentTerm: B2BPaymentTerm;
  status: CompanyStatus;
  users: CompanyUser[];
  createdAt: string;
  updatedAt: string;
}

export type RFQStatus = 'SUBMITTED' | 'QUOTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED_TO_ORDER';

export interface RFQItem {
  variantId: string;
  sku: string;
  productTitle: string;
  quantity: number;
  targetUnitPrice?: number;
  offeredUnitPrice?: number;
}

export interface RFQ {
  id: string;
  rfqNumber: string;
  companyId: string;
  companyName: string;
  submittedByEmail: string;
  items: RFQItem[];
  notes?: string;
  status: RFQStatus;
  quotedTotal?: number;
  adminQuoteNotes?: string;
  paymentTermOffered?: B2BPaymentTerm;
  validUntil?: string;
  convertedOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 9. INTERNATIONAL COMMERCE & LOCALIZATION
// ============================================================================

export type CurrencyCode = 'PKR' | 'USD' | 'AED' | 'SAR' | 'GBP' | 'EUR';
export type LanguageCode = 'en' | 'ur' | 'ar';
export type TextDirection = 'ltr' | 'rtl';

export interface ExchangeRateRecord {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  updatedAt: string;
}

export interface RegionConfig {
  countryCode: string;
  countryName: string;
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  defaultLanguage: LanguageCode;
  supportedLanguages: LanguageCode[];
  taxName: string;
  taxRatePercent: number;
  taxNumberLabel: string;
  taxNumberValue: string;
  shippingZone: string;
  defaultShippingFee: number;
  freeShippingThreshold: number;
}

export interface CustomsDeclaration {
  orderNumber: string;
  exportCountry: string;
  destinationCountry: string;
  carrier: string;
  hsCode: string;
  declaredValue: number;
  declaredCurrency: CurrencyCode;
  customsInvoiceNumber: string;
  createdAt: string;
}

// ============================================================================
// 10. AI COMMERCE ENGINE & RAG ASSISTANT
// ============================================================================

export interface AISearchResult {
  productId: string;
  title: string;
  slug: string;
  price: number;
  currency: string;
  brand?: string;
  categoryName?: string;
  lexicalScore: number;
  semanticScore: number;
  combinedScore: number;
  snippet: string;
}

export type AIChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
  timestamp?: string;
}

export interface RecommendedProduct {
  id: string;
  title: string;
  price: number;
  currency: string;
  slug: string;
  variantSummary: string;
}

export interface AIChatResponse {
  sessionId: string;
  reply: string;
  languageDetected: 'en' | 'ur' | 'ar';
  intent: 'PRODUCT_SEARCH' | 'PRODUCT_COMPARISON' | 'POLICY_INQUIRY' | 'GENERAL_SUPPORT';
  productsRecommended?: RecommendedProduct[];
  policyGroundedAnswer?: string;
  tokensUsed: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  guardrailPassed: boolean;
  securityFlag?: string;
}

export interface StorePolicy {
  id: string;
  category: 'RETURNS' | 'SHIPPING' | 'PAYMENTS' | 'WARRANTY';
  title: string;
  content: string;
  keywords: string[];
}

// ============================================================================
// 11. CENTRAL ADMINISTRATION, OPERATIONS & MARKETING
// ============================================================================

export interface AdminExecutiveMetrics {
  grossMerchandiseValue: number;
  netRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  activeSellersCount: number;
  pendingSellerKycCount: number;
  lowStockAlertsCount: number;
  currency: string;
  generatedAt: string;
}

export type BannerPlacement = 'HERO' | 'PROMO_STRIP' | 'SIDEBAR' | 'ANNOUNCEMENT';

export interface CMSBanner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  targetUrl: string;
  placement: BannerPlacement;
  displayOrder: number;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
}

export type CouponDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface Coupon {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  timesUsed: number;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
}

export interface CouponValidationResult {
  valid: boolean;
  discountAmount: number;
  finalCartTotal: number;
  reason?: string;
  coupon?: Coupon;
}

export interface SEOProductMeta {
  productId: string;
  title: string;
  canonicalUrl: string;
  metaDescription: string;
  openGraph: {
    title: string;
    description: string;
    image: string;
    type: 'product';
    url: string;
  };
  jsonLd: Record<string, any>;
}

