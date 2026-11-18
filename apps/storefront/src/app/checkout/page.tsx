'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/cart-store';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Truck, CreditCard } from 'lucide-react';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  'https://debro-production-022962ca.up.railway.app';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart } = useCartStore();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: 'Karachi',
    postalCode: '',
    paymentGateway: 'COD' as 'COD' | 'JAZZCASH' | 'EASYPAISA',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart?.id || cart.items.length === 0) {
      setErrorMessage('Your shopping cart is empty.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/cart/${cart.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: formData.email,
          customerPhone: formData.phone,
          paymentGateway: formData.paymentGateway,
          shippingAddress: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone,
            addressLine1: formData.address,
            city: formData.city,
            postalCode: formData.postalCode,
            countryCode: 'PK',
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Checkout failed');
      }

      // Order created!
      router.push(`/order-confirmed?orderNumber=${data.data.orderNumber}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during checkout');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Continue Shopping</span>
        </Link>
      </div>

      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-900">Secure Checkout</h1>
        <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>256-Bit SSL Encrypted</span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
          ⚠️ {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Customer & Delivery Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Details */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <span>1. Contact Information</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="e.g. yourname@gmail.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Mobile Phone (Pakistan) *</label>
                <input
                  type="tel"
                  name="phone"
                  required
                  placeholder="e.g. 03001234567"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>2. Delivery Address</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Last Name *</label>
                <input
                  type="text"
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block mb-1">Street Address *</label>
                <input
                  type="text"
                  name="address"
                  required
                  placeholder="House / Apartment, Street, Area / Sector"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">City *</label>
                <select
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-600 font-medium"
                >
                  <option value="Karachi">Karachi</option>
                  <option value="Lahore">Lahore</option>
                  <option value="Islamabad">Islamabad</option>
                  <option value="Rawalpindi">Rawalpindi</option>
                  <option value="Faisalabad">Faisalabad</option>
                  <option value="Multan">Multan</option>
                  <option value="Peshawar">Peshawar</option>
                  <option value="Quetta">Quetta</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Postal Code</label>
                <input
                  type="text"
                  name="postalCode"
                  placeholder="e.g. 75500"
                  value={formData.postalCode}
                  onChange={handleChange}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>3. Payment Method</span>
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentGateway"
                    value="COD"
                    checked={formData.paymentGateway === 'COD'}
                    onChange={handleChange}
                    className="text-blue-600"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Cash on Delivery (COD)</p>
                    <p className="text-[11px] text-slate-500">Pay cash directly to courier at your doorstep</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">Popular in Pakistan</span>
              </label>

              <label className="flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentGateway"
                    value="JAZZCASH"
                    checked={formData.paymentGateway === 'JAZZCASH'}
                    onChange={handleChange}
                    className="text-blue-600"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">JazzCash Mobile Account / Card</p>
                    <p className="text-[11px] text-slate-500">Instant digital checkout with MPIN</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded">Instant</span>
              </label>

              <label className="flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentGateway"
                    value="EASYPAISA"
                    checked={formData.paymentGateway === 'EASYPAISA'}
                    onChange={handleChange}
                    className="text-blue-600"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Easypaisa Wallet</p>
                    <p className="text-[11px] text-slate-500">Quick payment via Easypaisa registered number</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">Instant</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-fit">
          <h3 className="font-bold text-sm text-slate-900 pb-3 border-b border-slate-100">Order Summary</h3>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Items Total ({cart?.items.length || 0})</span>
              <span className="font-medium text-slate-900">Rs. {cart?.subtotal.toLocaleString() || '0'}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery (TCS / Leopards)</span>
              <span className="font-medium text-emerald-600">
                {cart?.shippingTotal === 0 ? 'FREE' : `Rs. ${cart?.shippingTotal || 250}`}
              </span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-3 border-t border-slate-100">
              <span>Total Amount</span>
              <span className="text-blue-600">Rs. {cart?.total.toLocaleString() || '0'}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !cart || cart.items.length === 0}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span>Processing Order...</span>
            ) : (
              <span>Confirm & Place Order ➔</span>
            )}
          </button>

          <p className="text-[11px] text-slate-400 text-center">
            By placing this order, you agree to NexStore's Terms of Service and 7-Day Return Guarantee.
          </p>
        </div>
      </form>
    </div>
  );
}
