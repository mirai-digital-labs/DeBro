import { Category, Product } from '@platform/types';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  'https://debro-production-022962ca.up.railway.app';

export async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/categories`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('Failed to fetch categories');
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.warn('Backend unavailable, using fallback categories', err);
    return [];
  }
}

export async function fetchCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/categories/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch (err) {
    return null;
  }
}

export async function fetchProducts(params: Record<string, string> = {}): Promise<Product[]> {
  try {
    const queryString = new URLSearchParams(params).toString();
    const url = `${BACKEND_URL}/api/v1/products${queryString ? `?${queryString}` : ''}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error('Failed to fetch products');
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.warn('Backend unavailable, returning empty list', err);
    return [];
  }
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/products/${slug}`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch (err) {
    return null;
  }
}
