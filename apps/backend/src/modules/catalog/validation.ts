import { z } from 'zod';
import { Category, CategoryAttribute, Product } from '@platform/types';

/**
 * Result of dynamic attribute validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
}

/**
 * Dynamic Attribute Validation Engine
 * Validates arbitrary product payloads dynamically against category attribute rules
 */
export class DynamicCatalogValidator {
  /**
   * Validate a product's attributes against category attributes definition
   */
  public static validateProductAttributes(
    category: Category,
    attributes: Record<string, any>
  ): ValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    const categoryAttrs = category.attributes || [];

    for (const attr of categoryAttrs) {
      const val = attributes[attr.code];

      // 1. Required Field Check
      if (attr.isRequired && (val === undefined || val === null || val === '')) {
        errors.push({
          field: `attributes.${attr.code}`,
          message: `Attribute '${attr.label}' (${attr.code}) is mandatory for category '${category.name}'.`,
        });
        continue;
      }

      // If value is omitted and not required, skip further checks
      if (val === undefined || val === null || val === '') {
        continue;
      }

      // 2. Data Type & Constraint Checks
      switch (attr.type) {
        case 'NUMBER':
          if (typeof val !== 'number' && isNaN(Number(val))) {
            errors.push({
              field: `attributes.${attr.code}`,
              message: `'${attr.label}' must be a valid number. Received: ${typeof val}.`,
            });
          }
          break;

        case 'BOOLEAN':
          if (typeof val !== 'boolean' && val !== 'true' && val !== 'false') {
            errors.push({
              field: `attributes.${attr.code}`,
              message: `'${attr.label}' must be a boolean (true/false).`,
            });
          }
          break;

        case 'SELECT':
          if (attr.options && attr.options.length > 0) {
            const allowedValues = attr.options.map((o) => o.value.toLowerCase());
            if (!allowedValues.includes(String(val).toLowerCase())) {
              errors.push({
                field: `attributes.${attr.code}`,
                message: `'${attr.label}' value '${val}' is not valid. Allowed options: [${attr.options.map((o) => o.value).join(', ')}].`,
              });
            }
          }
          break;

        case 'MULTI_SELECT':
          if (!Array.isArray(val)) {
            errors.push({
              field: `attributes.${attr.code}`,
              message: `'${attr.label}' must be an array of selected options.`,
            });
          } else if (attr.options && attr.options.length > 0) {
            const allowedValues = attr.options.map((o) => o.value.toLowerCase());
            for (const item of val) {
              if (!allowedValues.includes(String(item).toLowerCase())) {
                errors.push({
                  field: `attributes.${attr.code}`,
                  message: `Invalid option '${item}' in '${attr.label}'. Allowed: [${attr.options.map((o) => o.value).join(', ')}].`,
                });
              }
            }
          }
          break;

        case 'TEXT':
        default:
          if (typeof val !== 'string') {
            errors.push({
              field: `attributes.${attr.code}`,
              message: `'${attr.label}' must be a text string.`,
            });
          } else if (attr.validationRegex) {
            const regex = new RegExp(attr.validationRegex);
            if (!regex.test(val)) {
              errors.push({
                field: `attributes.${attr.code}`,
                message: `'${attr.label}' does not match required format pattern (${attr.validationRegex}).`,
              });
            }
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate Base Product & Variants Structure
   */
  public static validateProductPayload(payload: any): {
    success: boolean;
    data?: any;
    error?: z.ZodError;
  } {
    const productSchema = z.object({
      categoryId: z.string().min(1, 'categoryId is required'),
      title: z.string().min(3, 'Product title must be at least 3 characters'),
      slug: z.string().min(3, 'Slug is required'),
      brand: z.string().optional(),
      shortDescription: z.string().max(500).optional(),
      description: z.string().optional(),
      productType: z.enum(['PHYSICAL', 'DIGITAL', 'SERVICE']).default('PHYSICAL'),
      status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
      attributesJson: z.record(z.any()).default({}),
      variants: z
        .array(
          z.object({
            sku: z.string().min(3, 'Variant SKU must be at least 3 characters'),
            title: z.string().min(1, 'Variant title is required'),
            price: z.number().positive('Variant price must be greater than 0'),
            compareAtPrice: z.number().positive().optional(),
            costPrice: z.number().positive().optional(),
            weightGrams: z.number().nonnegative().optional(),
            variantAttributes: z.record(z.any()).default({}),
            inventoryQuantity: z.number().int().nonnegative().default(0),
          })
        )
        .min(1, 'At least one variant (SKU) is required'),
      images: z
        .array(
          z.object({
            url: z.string().url('Invalid image URL'),
            altText: z.string().optional(),
            isThumbnail: z.boolean().default(false),
            displayOrder: z.number().default(0),
          })
        )
        .optional()
        .default([]),
    });

    const result = productSchema.safeParse(payload);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: result.data };
  }
}
