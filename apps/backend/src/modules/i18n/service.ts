import {
  CurrencyCode,
  LanguageCode,
  TextDirection,
  RegionConfig,
  CustomsDeclaration,
} from '@platform/types';

export class I18nService {
  // Exchange rates with PKR as base (1 PKR = x target currency)
  private fxRates: Map<CurrencyCode, number> = new Map([
    ['PKR', 1],
    ['USD', 0.0036], // ~278 PKR per USD
    ['AED', 0.0132], // ~75.8 PKR per AED
    ['SAR', 0.0135], // ~74.1 PKR per SAR
    ['GBP', 0.0028], // ~357 PKR per GBP
    ['EUR', 0.0033], // ~303 PKR per EUR
  ]);

  private regions: Map<string, RegionConfig> = new Map();
  private lockedOrderRates: Map<string, { currency: CurrencyCode; rate: number; timestamp: string }> = new Map();

  // Multilingual UI Dictionary
  private translations: Record<LanguageCode, Record<string, string>> = {
    en: {
      cart: 'Shopping Cart',
      checkout: 'Checkout',
      free_delivery: 'Free Delivery',
      cash_on_delivery: 'Cash on Delivery',
      order_confirmed: 'Order Confirmed',
      track_order: 'Track Order',
      tax_invoice: 'Official Tax Invoice',
      select_variant: 'Select Variant',
      in_stock: 'In Stock',
      low_stock: 'Low Stock',
    },
    ur: {
      cart: 'خریداری کی ٹوکری',
      checkout: 'ادائیگی',
      free_delivery: 'مفت ڈیلیوری',
      cash_on_delivery: 'کیش آن ڈیلیوری',
      order_confirmed: 'آرڈر تصدیق شدہ',
      track_order: 'آرڈر ٹریک کریں',
      tax_invoice: 'سرکاری ٹیکس انوائس',
      select_variant: 'ویرینٹ منتخب کریں',
      in_stock: 'دستیاب ہے',
      low_stock: 'محدود اسٹاک',
    },
    ar: {
      cart: 'عربة التسوق',
      checkout: 'إتمام الطلب',
      free_delivery: 'توصيل مجاني',
      cash_on_delivery: 'الدفع عند الاستلام',
      order_confirmed: 'تم تأكيد الطلب',
      track_order: 'تتبع الطلب',
      tax_invoice: 'فاتورة ضريبية رسمية',
      select_variant: 'اختر البديل',
      in_stock: 'متوفر في المخزون',
      low_stock: 'كمية محدودة',
    },
  };

  constructor() {
    this.seedRegions();
  }

  private seedRegions() {
    // 1. Pakistan (Domestic Flagship)
    this.regions.set('PK', {
      countryCode: 'PK',
      countryName: 'Pakistan',
      defaultCurrency: 'PKR',
      supportedCurrencies: ['PKR', 'USD'],
      defaultLanguage: 'ur',
      supportedLanguages: ['ur', 'en'],
      taxName: 'General Sales Tax (GST)',
      taxRatePercent: 18,
      taxNumberLabel: 'FBR STRN / NTN',
      taxNumberValue: 'STRN-9988776-1',
      shippingZone: 'ZONE_DOMESTIC_PK',
      defaultShippingFee: 250,
      freeShippingThreshold: 2999,
    });

    // 2. United Arab Emirates (Middle East Hub)
    this.regions.set('AE', {
      countryCode: 'AE',
      countryName: 'United Arab Emirates',
      defaultCurrency: 'AED',
      supportedCurrencies: ['AED', 'USD'],
      defaultLanguage: 'ar',
      supportedLanguages: ['ar', 'en'],
      taxName: 'Value Added Tax (VAT)',
      taxRatePercent: 5,
      taxNumberLabel: 'Federal Tax Authority TRN',
      taxNumberValue: 'TRN-100234567800003',
      shippingZone: 'ZONE_MIDDLE_EAST',
      defaultShippingFee: 35, // 35 AED
      freeShippingThreshold: 250, // Free over 250 AED
    });

    // 3. Saudi Arabia (GCC Expansion)
    this.regions.set('SA', {
      countryCode: 'SA',
      countryName: 'Kingdom of Saudi Arabia',
      defaultCurrency: 'SAR',
      supportedCurrencies: ['SAR', 'USD'],
      defaultLanguage: 'ar',
      supportedLanguages: ['ar', 'en'],
      taxName: 'ZATCA Value Added Tax (VAT)',
      taxRatePercent: 15,
      taxNumberLabel: 'ZATCA VAT ID',
      taxNumberValue: '300123456700003',
      shippingZone: 'ZONE_MIDDLE_EAST',
      defaultShippingFee: 45, // 45 SAR
      freeShippingThreshold: 300,
    });

    // 4. United States (North America)
    this.regions.set('US', {
      countryCode: 'US',
      countryName: 'United States of America',
      defaultCurrency: 'USD',
      supportedCurrencies: ['USD'],
      defaultLanguage: 'en',
      supportedLanguages: ['en'],
      taxName: 'State Sales Tax',
      taxRatePercent: 8,
      taxNumberLabel: 'Federal EIN',
      taxNumberValue: 'EIN-12-3456789',
      shippingZone: 'ZONE_INTERNATIONAL',
      defaultShippingFee: 25, // 25 USD
      freeShippingThreshold: 150,
    });

    // 5. United Kingdom (Europe)
    this.regions.set('GB', {
      countryCode: 'GB',
      countryName: 'United Kingdom',
      defaultCurrency: 'GBP',
      supportedCurrencies: ['GBP', 'EUR', 'USD'],
      defaultLanguage: 'en',
      supportedLanguages: ['en'],
      taxName: 'HMRC Value Added Tax (VAT)',
      taxRatePercent: 20,
      taxNumberLabel: 'HMRC VAT Number',
      taxNumberValue: 'GB-123456789',
      shippingZone: 'ZONE_INTERNATIONAL',
      defaultShippingFee: 20, // 20 GBP
      freeShippingThreshold: 120,
    });
  }

  // --------------------------------------------------------------------------
  // 1. Multi-Currency FX Engine
  // --------------------------------------------------------------------------
  public getRates() {
    return Object.fromEntries(this.fxRates.entries());
  }

  public convertCurrency(
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode
  ): { originalAmount: number; from: CurrencyCode; convertedAmount: number; to: CurrencyCode; rate: number } {
    if (from === to) {
      return { originalAmount: amount, from, convertedAmount: amount, to, rate: 1 };
    }

    const rateFrom = this.fxRates.get(from);
    const rateTo = this.fxRates.get(to);

    if (!rateFrom || !rateTo) {
      throw new Error(`Unsupported currency conversion pair '${from}' to '${to}'.`);
    }

    // Convert via PKR base: amountInPkr = amount / rateFrom, target = amountInPkr * rateTo
    const amountInPkr = amount / rateFrom;
    const convertedAmount = amountInPkr * rateTo;

    // Standard financial rounding: 2 decimal places for fiat
    const rounded = Math.round(convertedAmount * 100) / 100;
    const effectiveRate = Math.round((rateTo / rateFrom) * 100000) / 100000;

    return {
      originalAmount: amount,
      from,
      convertedAmount: rounded,
      to,
      rate: effectiveRate,
    };
  }

  public lockExchangeRate(orderId: string, currency: CurrencyCode): number {
    const rate = this.fxRates.get(currency) || 1;
    this.lockedOrderRates.set(orderId, {
      currency,
      rate,
      timestamp: new Date().toISOString(),
    });
    return rate;
  }

  public getLockedRate(orderId: string) {
    return this.lockedOrderRates.get(orderId) || null;
  }

  // --------------------------------------------------------------------------
  // 2. Regional Compliance & Tax Engine
  // --------------------------------------------------------------------------
  public getRegion(countryCode: string): RegionConfig {
    const reg = this.regions.get(countryCode.toUpperCase());
    if (!reg) {
      // Default to PK
      return this.regions.get('PK')!;
    }
    return reg;
  }

  public getAllRegions(): RegionConfig[] {
    return Array.from(this.regions.values());
  }

  public calculateRegionalTax(subtotal: number, countryCode: string = 'PK') {
    const region = this.getRegion(countryCode);
    const taxRate = region.taxRatePercent / 100;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const totalWithTax = Math.round((subtotal + taxAmount) * 100) / 100;

    return {
      countryCode: region.countryCode,
      countryName: region.countryName,
      currency: region.defaultCurrency,
      subtotal,
      taxName: region.taxName,
      taxRatePercent: region.taxRatePercent,
      taxAmount,
      totalWithTax,
      taxRegistrationNumber: {
        label: region.taxNumberLabel,
        value: region.taxNumberValue,
      },
    };
  }

  // --------------------------------------------------------------------------
  // 3. International Shipping & Customs Automation
  // --------------------------------------------------------------------------
  public calculateShipping(countryCode: string, subtotal: number, _weightGrams: number = 1000) {
    const region = this.getRegion(countryCode);

    let carrier = 'TCS Logistics Express';
    let estimatedDays = '2-3 Business Days';

    if (region.shippingZone === 'ZONE_MIDDLE_EAST') {
      carrier = 'DHL Express Middle East / Aramex';
      estimatedDays = '3-5 Business Days';
    } else if (region.shippingZone === 'ZONE_INTERNATIONAL') {
      carrier = 'DHL Express Worldwide / FedEx International';
      estimatedDays = '4-7 Business Days';
    }

    const isFree = subtotal >= region.freeShippingThreshold;
    const fee = isFree ? 0 : region.defaultShippingFee;

    return {
      countryCode: region.countryCode,
      zone: region.shippingZone,
      carrier,
      estimatedDays,
      currency: region.defaultCurrency,
      shippingFee: fee,
      isFreeShipping: isFree,
      freeShippingThreshold: region.freeShippingThreshold,
    };
  }

  public generateCustomsDeclaration(
    orderNumber: string,
    destinationCountry: string,
    declaredValue: number,
    declaredCurrency: CurrencyCode = 'USD',
    hsCode?: string
  ): CustomsDeclaration {
    const defaultHsCode = hsCode || (destinationCountry === 'AE' || destinationCountry === 'SA' ? '8471.30.00' : '6205.20.00');
    const invoiceNum = `EXP-CUST-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    return {
      orderNumber,
      exportCountry: 'Pakistan (PK)',
      destinationCountry: destinationCountry.toUpperCase(),
      carrier: destinationCountry.toUpperCase() === 'PK' ? 'TCS Express' : 'DHL Express Worldwide',
      hsCode: defaultHsCode,
      declaredValue,
      declaredCurrency,
      customsInvoiceNumber: invoiceNum,
      createdAt: new Date().toISOString(),
    };
  }

  // --------------------------------------------------------------------------
  // 4. Localization & RTL Text Direction Engine
  // --------------------------------------------------------------------------
  public getTextDirection(lang: LanguageCode): TextDirection {
    return lang === 'ur' || lang === 'ar' ? 'rtl' : 'ltr';
  }

  public getTranslations(lang: LanguageCode = 'en'): { language: LanguageCode; direction: TextDirection; strings: Record<string, string> } {
    const validLang: LanguageCode = this.translations[lang] ? lang : 'en';
    const direction = this.getTextDirection(validLang);
    return {
      language: validLang,
      direction,
      strings: this.translations[validLang],
    };
  }
}

// Singleton Service Instance
export const i18nService = new I18nService();
