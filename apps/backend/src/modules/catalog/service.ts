import { Category, Product, ProductStatus } from '@platform/types';
import { SEED_CATEGORIES, SEED_PRODUCTS } from './seed.js';
import { DynamicCatalogValidator } from './validation.js';

export interface ProductFilterQuery {
  categoryId?: string;
  categorySlug?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  status?: ProductStatus;
  attributes?: Record<string, string | number | boolean>;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'title_asc';
  limit?: number;
  offset?: number;
}

export class CatalogService {
  private categories: Map<string, Category> = new Map();
  private products: Map<string, Product> = new Map();

  constructor() {
    // Initialize with comprehensive seed data
    for (const cat of SEED_CATEGORIES) {
      this.categories.set(cat.id, cat);
    }
    for (const prod of SEED_PRODUCTS) {
      this.products.set(prod.id, prod);
    }
  }

  // --------------------------------------------------------------------------
  // Category Methods
  // --------------------------------------------------------------------------
  public async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values()).filter((c) => c.isActive);
  }

  public async getCategoryByIdOrSlug(idOrSlug: string): Promise<Category | null> {
    for (const cat of this.categories.values()) {
      if (cat.id === idOrSlug || cat.slug === idOrSlug) {
        return cat;
      }
    }
    return null;
  }

  public async createCategory(category: Category): Promise<Category> {
    if (this.categories.has(category.id)) {
      throw new Error(`Category with ID '${category.id}' already exists.`);
    }
    category.createdAt = new Date().toISOString();
    category.updatedAt = new Date().toISOString();
    this.categories.set(category.id, category);
    return category;
  }

  // --------------------------------------------------------------------------
  // Product Query & Filtering Engine
  // --------------------------------------------------------------------------
  public async getProducts(query: ProductFilterQuery = {}): Promise<{
    items: Product[];
    total: number;
    limit: number;
    offset: number;
  }> {
    let results = Array.from(this.products.values());

    // 1. Filter by Status (Default to PUBLISHED for public storefront)
    const targetStatus = query.status || 'PUBLISHED';
    results = results.filter((p) => p.status === targetStatus);

    // 2. Filter by Category
    if (query.categoryId) {
      results = results.filter((p) => p.categoryId === query.categoryId);
    } else if (query.categorySlug) {
      const cat = await this.getCategoryByIdOrSlug(query.categorySlug);
      if (cat) {
        results = results.filter((p) => p.categoryId === cat.id);
      } else {
        return { items: [], total: 0, limit: query.limit || 20, offset: query.offset || 0 };
      }
    }

    // 3. Filter by Brand
    if (query.brand) {
      results = results.filter(
        (p) => p.brand && p.brand.toLowerCase() === query.brand!.toLowerCase()
      );
    }

    // 4. Keyword Search (Title, Description, Brand, SKU)
    if (query.search) {
      const q = query.search.toLowerCase().trim();
      results = results.filter((p) => {
        const titleMatch = p.title.toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        const brandMatch = (p.brand || '').toLowerCase().includes(q);
        const skuMatch = p.variants.some((v) => v.sku.toLowerCase().includes(q));
        const attrMatch = Object.values(p.attributesJson).some((val) =>
          String(val).toLowerCase().includes(q)
        );
        return titleMatch || descMatch || brandMatch || skuMatch || attrMatch;
      });
    }

    // 5. Price Range Filtering (Based on lowest variant price)
    if (query.minPrice !== undefined) {
      results = results.filter((p) => {
        const minVariantPrice = Math.min(...p.variants.map((v) => v.price));
        return minVariantPrice >= query.minPrice!;
      });
    }
    if (query.maxPrice !== undefined) {
      results = results.filter((p) => {
        const minVariantPrice = Math.min(...p.variants.map((v) => v.price));
        return minVariantPrice <= query.maxPrice!;
      });
    }

    // 6. Dynamic Category Attributes Filtering
    if (query.attributes && Object.keys(query.attributes).length > 0) {
      results = results.filter((p) => {
        for (const [attrCode, expectedVal] of Object.entries(query.attributes!)) {
          // Check product-level dynamic attributes
          const prodVal = p.attributesJson[attrCode];
          if (prodVal !== undefined && String(prodVal).toLowerCase() === String(expectedVal).toLowerCase()) {
            continue;
          }
          // Check variant-level dynamic attributes
          const variantMatch = p.variants.some((v) => {
            const vVal = v.variantAttributes[attrCode];
            return vVal !== undefined && String(vVal).toLowerCase() === String(expectedVal).toLowerCase();
          });

          if (!variantMatch) {
            return false;
          }
        }
        return true;
      });
    }

    // 7. Sorting
    if (query.sortBy) {
      switch (query.sortBy) {
        case 'price_asc':
          results.sort(
            (a, b) =>
              Math.min(...a.variants.map((v) => v.price)) -
              Math.min(...b.variants.map((v) => v.price))
          );
          break;
        case 'price_desc':
          results.sort(
            (a, b) =>
              Math.max(...b.variants.map((v) => v.price)) -
              Math.max(...a.variants.map((v) => v.price))
          );
          break;
        case 'title_asc':
          results.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case 'newest':
        default:
          results.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          break;
      }
    }

    const total = results.length;
    const limit = query.limit || 20;
    const offset = query.offset || 0;
    const paginatedItems = results.slice(offset, offset + limit);

    return {
      items: paginatedItems,
      total,
      limit,
      offset,
    };
  }

  public async getProductByIdOrSlug(idOrSlug: string): Promise<Product | null> {
    for (const prod of this.products.values()) {
      if (prod.id === idOrSlug || prod.slug === idOrSlug) {
        // Embed category object if available
        const category = this.categories.get(prod.categoryId);
        return {
          ...prod,
          category,
        };
      }
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Product Creation with Dynamic Category Validation
  // --------------------------------------------------------------------------
  public async createProduct(payload: any): Promise<Product> {
    // Step 1: Base Payload Validation
    const baseValidation = DynamicCatalogValidator.validateProductPayload(payload);
    if (!baseValidation.success) {
      const formattedErrors = baseValidation.error!.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      const error: any = new Error('Product schema validation failed');
      error.status = 400;
      error.details = formattedErrors;
      throw error;
    }

    const validData = baseValidation.data;

    // Step 2: Category Existence Check
    const category = await this.getCategoryByIdOrSlug(validData.categoryId);
    if (!category) {
      const error: any = new Error(`Category with ID '${validData.categoryId}' does not exist.`);
      error.status = 404;
      throw error;
    }

    // Step 3: Dynamic Category-Specific Attribute Validation
    const attrValidation = DynamicCatalogValidator.validateProductAttributes(
      category,
      validData.attributesJson
    );
    if (!attrValidation.isValid) {
      const error: any = new Error(
        `Dynamic attribute validation failed for category '${category.name}'`
      );
      error.status = 422;
      error.details = attrValidation.errors;
      throw error;
    }

    // Step 4: Slug & SKU Uniqueness Verification
    for (const existing of this.products.values()) {
      if (existing.slug === validData.slug) {
        const error: any = new Error(`Product slug '${validData.slug}' is already taken.`);
        error.status = 409;
        throw error;
      }
    }

    const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const createdProduct: Product = {
      id: productId,
      categoryId: category.id,
      title: validData.title,
      slug: validData.slug,
      brand: validData.brand,
      shortDescription: validData.shortDescription,
      description: validData.description,
      productType: validData.productType,
      status: validData.status,
      attributesJson: validData.attributesJson,
      images: (validData.images || []).map((img: any, idx: number) => ({
        id: `img_${productId}_${idx}`,
        productId,
        url: img.url,
        altText: img.altText || validData.title,
        isThumbnail: img.isThumbnail ?? idx === 0,
        displayOrder: img.displayOrder ?? idx,
      })),
      variants: validData.variants.map((v: any, idx: number) => ({
        id: `var_${productId}_${idx}`,
        productId,
        sku: v.sku,
        title: v.title,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        costPrice: v.costPrice,
        weightGrams: v.weightGrams,
        inventoryQuantity: v.inventoryQuantity ?? 0,
        variantAttributes: v.variantAttributes || {},
        createdAt: now,
        updatedAt: now,
      })),
      category,
      createdAt: now,
      updatedAt: now,
    };

    this.products.set(createdProduct.id, createdProduct);
    return createdProduct;
  }

  // --------------------------------------------------------------------------
  // Product Lifecycle State Machine
  // --------------------------------------------------------------------------
  public async updateProductStatus(
    productId: string,
    newStatus: ProductStatus
  ): Promise<Product> {
    const product = this.products.get(productId);
    if (!product) {
      const error: any = new Error(`Product with ID '${productId}' not found.`);
      error.status = 404;
      throw error;
    }

    const validTransitions: Record<ProductStatus, ProductStatus[]> = {
      DRAFT: ['PENDING_REVIEW', 'ARCHIVED'],
      PENDING_REVIEW: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
      PUBLISHED: ['DRAFT', 'ARCHIVED'],
      ARCHIVED: ['DRAFT'],
    };

    const allowed = validTransitions[product.status];
    if (!allowed || !allowed.includes(newStatus)) {
      const error: any = new Error(
        `Invalid lifecycle transition from '${product.status}' to '${newStatus}'. Allowed: [${allowed.join(', ')}]`
      );
      error.status = 400;
      throw error;
    }

    product.status = newStatus;
    product.updatedAt = new Date().toISOString();
    this.products.set(product.id, product);
    return product;
  }
}

// Singleton Service Instance
export const catalogService = new CatalogService();
