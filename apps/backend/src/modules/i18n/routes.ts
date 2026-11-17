import { Router, Request, Response, NextFunction } from 'express';
import { i18nService } from './service.js';
import { CurrencyCode, LanguageCode } from '@platform/types';

export const i18nRouter = Router();

// ----------------------------------------------------------------------------
// Currency & FX Endpoints
// ----------------------------------------------------------------------------

/**
 * GET /api/v1/i18n/currencies
 * List live FX rates table
 */
i18nRouter.get('/i18n/currencies', (_req: Request, res: Response) => {
  const rates = i18nService.getRates();
  res.status(200).json({
    success: true,
    baseCurrency: 'PKR',
    rates,
  });
});

/**
 * POST /api/v1/i18n/currencies/convert
 * Convert amount between supported currencies
 */
i18nRouter.post('/i18n/currencies/convert', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, from, to } = req.body;
    if (amount === undefined || !from || !to) {
      return res.status(400).json({
        success: false,
        error: { message: 'amount, from, and to currency codes are required.' },
      });
    }

    const conversion = i18nService.convertCurrency(
      parseFloat(amount),
      from.toUpperCase() as CurrencyCode,
      to.toUpperCase() as CurrencyCode
    );

    res.status(200).json({
      success: true,
      data: conversion,
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
// Regional Tax & Compliance Endpoints
// ----------------------------------------------------------------------------

/**
 * GET /api/v1/i18n/regions
 * List all regional configurations (PK, AE, SA, US, GB)
 */
i18nRouter.get('/i18n/regions', (_req: Request, res: Response) => {
  const regions = i18nService.getAllRegions();
  res.status(200).json({
    success: true,
    data: regions,
  });
});

/**
 * GET /api/v1/i18n/regions/:countryCode
 * Get region configuration by country code
 */
i18nRouter.get('/i18n/regions/:countryCode', (req: Request, res: Response) => {
  const region = i18nService.getRegion(req.params.countryCode);
  res.status(200).json({
    success: true,
    data: region,
  });
});

/**
 * POST /api/v1/i18n/tax/calculate
 * Calculate regional tax with compliant invoice registration numbers
 */
i18nRouter.post('/i18n/tax/calculate', (req: Request, res: Response) => {
  const { subtotal, countryCode } = req.body;
  if (subtotal === undefined) {
    return res.status(400).json({
      success: false,
      error: { message: 'subtotal is required.' },
    });
  }

  const tax = i18nService.calculateRegionalTax(parseFloat(subtotal), countryCode || 'PK');
  res.status(200).json({
    success: true,
    data: tax,
  });
});

// ----------------------------------------------------------------------------
// International Shipping & Customs Automation
// ----------------------------------------------------------------------------

/**
 * POST /api/v1/i18n/shipping/calculate
 * Calculate international shipping fee and delivery SLA by country
 */
i18nRouter.post('/i18n/shipping/calculate', (req: Request, res: Response) => {
  const { countryCode, subtotal, weightGrams } = req.body;
  if (!countryCode || subtotal === undefined) {
    return res.status(400).json({
      success: false,
      error: { message: 'countryCode and subtotal are required.' },
    });
  }

  const quote = i18nService.calculateShipping(
    countryCode,
    parseFloat(subtotal),
    weightGrams ? parseInt(weightGrams, 10) : 1000
  );

  res.status(200).json({
    success: true,
    data: quote,
  });
});

/**
 * POST /api/v1/i18n/customs/declaration
 * Generate formal export customs declaration with HS Tariff Code
 */
i18nRouter.post('/i18n/customs/declaration', (req: Request, res: Response) => {
  const { orderNumber, destinationCountry, declaredValue, declaredCurrency, hsCode } = req.body;
  if (!orderNumber || !destinationCountry || declaredValue === undefined) {
    return res.status(400).json({
      success: false,
      error: { message: 'orderNumber, destinationCountry, and declaredValue are required.' },
    });
  }

  const declaration = i18nService.generateCustomsDeclaration(
    orderNumber,
    destinationCountry,
    parseFloat(declaredValue),
    (declaredCurrency || 'USD') as CurrencyCode,
    hsCode
  );

  res.status(201).json({
    success: true,
    message: 'Export customs declaration generated successfully',
    data: declaration,
  });
});

// ----------------------------------------------------------------------------
// Multilingual & RTL Endpoints
// ----------------------------------------------------------------------------

/**
 * GET /api/v1/i18n/translations/:lang
 * Fetch localized dictionary with LTR/RTL text direction metadata
 */
i18nRouter.get('/i18n/translations/:lang', (req: Request, res: Response) => {
  const lang = req.params.lang.toLowerCase() as LanguageCode;
  const translations = i18nService.getTranslations(lang);
  res.status(200).json({
    success: true,
    data: translations,
  });
});
