import { StorePolicy } from '@platform/types';

export const GROUNDED_STORE_POLICIES: StorePolicy[] = [
  {
    id: 'pol_returns_01',
    category: 'RETURNS',
    title: 'Customer Return & Refund Policy (RMA)',
    content:
      'NexStore provides a transparent 7-day hassle-free return window for all unwashed, undamaged items in original packaging with tags intact. Returns can only be initiated on orders with DELIVERED status. Once received and inspected at our Karachi or Lahore hub, refunds are credited back within 48 to 72 hours via original payment method or bank transfer for Cash on Delivery.',
    keywords: ['return', 'refund', 'exchange', 'damage', 'wapsi', 'money back', 'rma'],
  },
  {
    id: 'pol_shipping_02',
    category: 'SHIPPING',
    title: 'Nationwide Delivery & Shipping Rates',
    content:
      'We offer nationwide delivery across Pakistan via TCS Express and Leopards. Orders above Rs. 2,999 qualify for 100% FREE Delivery nationwide; otherwise, a flat standard shipping fee of Rs. 250 applies. Domestic delivery takes 2 to 3 business days. International Middle East shipments (UAE, Saudi Arabia) are dispatched via DHL Express with a 3 to 5 business day delivery window.',
    keywords: ['shipping', 'delivery', 'tcs', 'charges', 'free shipping', 'charges', 'time', 'dhl', 'express'],
  },
  {
    id: 'pol_payments_03',
    category: 'PAYMENTS',
    title: 'Accepted Payment Methods & COD Rules',
    content:
      'We accept Cash on Delivery (COD), JazzCash (Mobile Wallet & Card), Easypaisa, and international credit/debit cards via Stripe (Visa, Mastercard, 3D Secure). For COD orders exceeding Rs. 50,000, our verification department conducts a quick phone confirmation before dispatch to prevent delivery refusal.',
    keywords: ['payment', 'cod', 'cash on delivery', 'jazzcash', 'easypaisa', 'stripe', 'credit card', 'debit card'],
  },
  {
    id: 'pol_warranty_04',
    category: 'WARRANTY',
    title: 'Manufacturer Brand Warranty & Authenticity',
    content:
      'All tech products sold on NexStore are 100% genuine with verifiable brand warranty. Ultrabook Pro laptops include a 12-month official manufacturer brand warranty. ThinkBook Workstations include an extended 24-month comprehensive warranty covering hardware, battery, and display diagnostics across Pakistan authorized centers.',
    keywords: ['warranty', 'guarantee', 'authentic', 'genuine', 'claim', 'service center'],
  },
];
