import { AISearchResult, Product } from '@platform/types';
import { EmbeddingPipeline } from './embeddings.js';
import { catalogService } from '../catalog/service.js';

interface IndexedProduct {
  product: Product;
  documentText: string;
  vector: number[];
}

export class HybridSearchEngine {
  private index: IndexedProduct[] = [];
  private isIndexed = false;

  private async ensureIndex() {
    if (this.isIndexed && this.index.length > 0) return;

    const allProducts = (await catalogService.getProducts({ limit: 200 })).items;
    const categories = await catalogService.getCategories();
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    this.index = allProducts.map((p) => {
      // Attach category object if missing
      if (!p.category && p.categoryId) {
        p.category = categoryMap.get(p.categoryId);
      }

      // Create rich composite document text for indexing
      const attrStrings = Object.entries(p.attributesJson || {})
        .map(([k, v]) => `${k} ${v}`)
        .join(' ');
      const variantStrings = p.variants
        .map((v) => `${v.title} ${v.sku} ${v.price}`)
        .join(' ');

      const docText = `${p.title} ${p.brand || ''} ${p.category?.name || ''} ${p.category?.slug || ''} ${p.shortDescription || ''} ${p.description || ''} ${attrStrings} ${variantStrings}`.toLowerCase();
      const vector = EmbeddingPipeline.generateEmbedding(docText);

      return {
        product: p,
        documentText: docText,
        vector,
      };
    });

    this.isIndexed = true;
  }

  public async search(
    query: string,
    categorySlug?: string,
    maxPrice?: number,
    limit: number = 5
  ): Promise<AISearchResult[]> {
    await this.ensureIndex();

    const queryClean = query.toLowerCase().trim();
    const queryTokens = queryClean.split(/\s+/).filter((t) => t.length > 0);
    const queryVector = EmbeddingPipeline.generateEmbedding(queryClean);

    const candidates = this.index.filter((item) => {
      if (
        categorySlug &&
        item.product.category?.slug !== categorySlug &&
        item.product.categoryId !== categorySlug
      ) {
        return false;
      }
      if (maxPrice && item.product.variants[0]?.price > maxPrice) {
        return false;
      }
      return true;
    });

    // Score candidates with Lexical & Semantic metrics
    const scored = candidates.map((item) => {
      // 1. Lexical Scoring (Token match + Substring overlap)
      let matchedTokens = 0;
      for (const token of queryTokens) {
        if (item.documentText.includes(token)) {
          matchedTokens++;
        }
      }
      const lexicalScore = queryTokens.length > 0 ? matchedTokens / queryTokens.length : 0;

      // 2. Semantic Cosine Vector Score
      const semanticScore = EmbeddingPipeline.cosineSimilarity(queryVector, item.vector);

      // 3. Reciprocal Rank Fusion / Combined Weighted Score (60% semantic + 40% lexical)
      const combinedScore = Math.round((semanticScore * 0.6 + lexicalScore * 0.4) * 1000) / 1000;

      const primaryVariant = item.product.variants[0];
      const snippet = `${item.product.title} - ${primaryVariant?.title || ''}. ${item.product.shortDescription || ''}`;

      return {
        productId: item.product.id,
        title: item.product.title,
        slug: item.product.slug,
        price: primaryVariant?.price || 0,
        currency: 'PKR',
        brand: item.product.brand,
        categoryName: item.product.category?.name,
        lexicalScore: Math.round(lexicalScore * 100) / 100,
        semanticScore: Math.round(semanticScore * 100) / 100,
        combinedScore,
        snippet,
      };
    });

    // Sort by combined score descending
    scored.sort((a, b) => b.combinedScore - a.combinedScore);

    return scored.slice(0, limit);
  }
}

export const hybridSearchEngine = new HybridSearchEngine();
