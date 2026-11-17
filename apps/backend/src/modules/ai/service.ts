import {
  AIChatResponse,
  AISearchResult,
  Product,
  RecommendedProduct,
  StorePolicy,
} from '@platform/types';
import { catalogService } from '../catalog/service.js';
import { AIGuardrails } from './guardrails.js';
import { GROUNDED_STORE_POLICIES } from './policies.js';
import { hybridSearchEngine } from './search.js';
import { EmbeddingPipeline } from './embeddings.js';

export interface ProductComparisonResult {
  productA: {
    id: string;
    title: string;
    slug: string;
    brand?: string;
    price: number;
    currency: string;
    specs: Record<string, any>;
  };
  productB: {
    id: string;
    title: string;
    slug: string;
    brand?: string;
    price: number;
    currency: string;
    specs: Record<string, any>;
  };
  priceDifference: number;
  cheaperProductSlug: string;
  verdict: string;
}

export class AIService {
  /**
   * Hybrid Lexical + Semantic Product Search
   */
  public async hybridSearch(
    query: string,
    categorySlug?: string,
    maxPrice?: number,
    limit: number = 5
  ): Promise<AISearchResult[]> {
    return hybridSearchEngine.search(query, categorySlug, maxPrice, limit);
  }

  /**
   * Head-to-Head Product Comparison Engine
   */
  public async compareProducts(slugA: string, slugB: string): Promise<ProductComparisonResult> {
    const prodA = await catalogService.getProductByIdOrSlug(slugA);
    const prodB = await catalogService.getProductByIdOrSlug(slugB);

    if (!prodA) {
      throw new Error(`Product not found with slug or ID: ${slugA}`);
    }
    if (!prodB) {
      throw new Error(`Product not found with slug or ID: ${slugB}`);
    }

    const priceA = prodA.variants[0]?.price || 0;
    const priceB = prodB.variants[0]?.price || 0;
    const diff = Math.abs(priceA - priceB);
    const cheaper = priceA <= priceB ? prodA.slug : prodB.slug;

    // Build comparison verdict
    let verdict = '';
    if (prodA.categoryId === 'cat_tech_laptops' && prodB.categoryId === 'cat_tech_laptops') {
      const cpuA = prodA.attributesJson?.processor || 'Standard CPU';
      const cpuB = prodB.attributesJson?.processor || 'Standard CPU';
      const ramA = prodA.variants[0]?.variantAttributes?.ram_gb || '16GB';
      const ramB = prodB.variants[0]?.variantAttributes?.ram_gb || '16GB';

      verdict = `${prodA.title} (${cpuA}, ${ramA}) vs ${prodB.title} (${cpuB}, ${ramB}). `;
      if (priceA < priceB) {
        verdict += `${prodA.title} is more affordable by Rs. ${diff.toLocaleString('en-PK')}, making it ideal for ultra-portable mobility. `;
      } else {
        verdict += `${prodB.title} is more budget-friendly by Rs. ${diff.toLocaleString('en-PK')}. `;
      }
      verdict += `${prodB.title} offers heavy workstation performance, while ${prodA.title} excels in OLED display and battery efficiency.`;
    } else {
      verdict = `Comparing ${prodA.title} (Rs. ${priceA.toLocaleString('en-PK')}) with ${prodB.title} (Rs. ${priceB.toLocaleString('en-PK')}). Price difference is Rs. ${diff.toLocaleString('en-PK')}.`;
    }

    return {
      productA: {
        id: prodA.id,
        title: prodA.title,
        slug: prodA.slug,
        brand: prodA.brand,
        price: priceA,
        currency: 'PKR',
        specs: {
          ...prodA.attributesJson,
          variant: prodA.variants[0]?.title,
        },
      },
      productB: {
        id: prodB.id,
        title: prodB.title,
        slug: prodB.slug,
        brand: prodB.brand,
        price: priceB,
        currency: 'PKR',
        specs: {
          ...prodB.attributesJson,
          variant: prodB.variants[0]?.title,
        },
      },
      priceDifference: diff,
      cheaperProductSlug: cheaper,
      verdict,
    };
  }

  /**
   * Conversational AI Assistant with RAG, Guardrails, and Multilingual Intelligence
   */
  public async chat(
    sessionId: string,
    message: string,
    languagePreference?: 'en' | 'ur' | 'ar'
  ): Promise<AIChatResponse> {
    // 1. Guardrail Evaluation
    const guardrailCheck = AIGuardrails.evaluate(message);
    if (!guardrailCheck.safe) {
      const refusalReply =
        'I cannot fulfill this request due to safety, security, or policy constraints.';
      const tokens = AIGuardrails.calculateTokens(message, refusalReply);
      return {
        sessionId,
        reply: refusalReply,
        languageDetected: 'en',
        intent: 'GENERAL_SUPPORT',
        tokensUsed: tokens,
        guardrailPassed: false,
        securityFlag: guardrailCheck.flag,
      };
    }

    const cleanInput = guardrailCheck.sanitizedInput;

    // 2. Language Detection
    const detectedLang = this.detectLanguage(cleanInput, languagePreference);

    // 3. Intent Detection
    const intent = this.detectIntent(cleanInput);

    let reply = '';
    let productsRecommended: RecommendedProduct[] | undefined;
    let policyGroundedAnswer: string | undefined;

    // 4. Intent Handlers
    switch (intent) {
      case 'POLICY_INQUIRY': {
        const policy = this.findBestMatchingPolicy(cleanInput);
        policyGroundedAnswer = policy.content;

        if (detectedLang === 'ur') {
          reply = this.formatUrduPolicyReply(policy);
        } else if (detectedLang === 'ar') {
          reply = `وفقاً لسياسة المتجر الرسمية (${policy.title}): ${policy.content}`;
        } else {
          reply = `According to our official store policy (${policy.title}): ${policy.content}`;
        }
        break;
      }

      case 'PRODUCT_COMPARISON': {
        // Find laptops or products mentioned
        const searchResults = await this.hybridSearch(cleanInput, undefined, undefined, 2);
        if (searchResults.length >= 2) {
          const comp = await this.compareProducts(searchResults[0].slug, searchResults[1].slug);
          if (detectedLang === 'ur') {
            reply = `Muqabla: ${comp.productA.title} (Rs. ${comp.productA.price.toLocaleString('en-PK')}) aur ${comp.productB.title} (Rs. ${comp.productB.price.toLocaleString('en-PK')}). ${comp.verdict}`;
          } else {
            reply = comp.verdict;
          }
          productsRecommended = searchResults.map((s) => ({
            id: s.productId,
            title: s.title,
            price: s.price,
            currency: s.currency,
            slug: s.slug,
            variantSummary: s.snippet,
          }));
        } else {
          reply =
            detectedLang === 'ur'
              ? 'Baraye meharbani jin do products ka muqabla karna hai unke naam batayein (maslan: Ultrabook aur ThinkBook).'
              : 'Please specify the two products you would like to compare (e.g. Ultrabook Pro vs ThinkBook).';
        }
        break;
      }

      case 'PRODUCT_SEARCH': {
        const searchResults = await this.hybridSearch(cleanInput, undefined, undefined, 3);
        if (searchResults.length > 0) {
          productsRecommended = searchResults.map((s) => ({
            id: s.productId,
            title: s.title,
            price: s.price,
            currency: s.currency,
            slug: s.slug,
            variantSummary: s.snippet,
          }));

          if (detectedLang === 'ur') {
            const listText = searchResults
              .map((r, i) => `${i + 1}. ${r.title} - Rs. ${r.price.toLocaleString('en-PK')}`)
              .join('\n');
            reply = `Aap ki talash ke mutabiq yeh behtareen items dastiyab hain:\n${listText}\n\nKya aap inki mazeed tafseelat ya specs dekhna chahtay hain?`;
          } else if (detectedLang === 'ar') {
            const listText = searchResults
              .map((r, i) => `${i + 1}. ${r.title} - ${r.price.toLocaleString('en-PK')} PKR`)
              .join('\n');
            reply = `بناءً على بحثك، إليك أفضل الخيارات المتاحة:\n${listText}`;
          } else {
            const listText = searchResults
              .map((r, i) => `${i + 1}. ${r.title} - Rs. ${r.price.toLocaleString('en-PK')}`)
              .join('\n');
            reply = `Here are the top matches found for your search:\n${listText}\n\nWould you like further specifications or assistance with checkout?`;
          }
        } else {
          reply =
            detectedLang === 'ur'
              ? 'Aap ki query ke mutabiq koi product nahi mila. Baraye meherbani laptop ya shirt search karein.'
              : 'No matching products found. Try searching for "ultrabook", "thinkbook", or "oxford shirt".';
        }
        break;
      }

      case 'GENERAL_SUPPORT':
      default: {
        if (detectedLang === 'ur') {
          reply =
            'Khushamdeed! Main DeBro AI Shopping Assistant hoon. Main aap ko product dhoondnay, specs compare karnay, aur return ya delivery policies samajhnay mein madad faraham kar sakta hoon. Main aap ki kya madad karoon?';
        } else if (detectedLang === 'ar') {
          reply =
            'مرحباً بك! أنا مساعد التسوق الذكي DeBro AI. يمكنني مساعدتك في العثور على المنتجات، مقارنة المواصفات، والاستفسار عن سياسات الشحن والإرجاع. كيف يمكنني خدمتك اليوم؟';
        } else {
          reply =
            'Welcome! I am the DeBro AI Commerce Assistant. I can assist you with finding products, comparing laptop specs, explaining return and delivery policies, or placing wholesale orders. How can I help you today?';
        }
        break;
      }
    }

    const tokensUsed = AIGuardrails.calculateTokens(cleanInput, reply);

    return {
      sessionId,
      reply,
      languageDetected: detectedLang,
      intent,
      productsRecommended,
      policyGroundedAnswer,
      tokensUsed,
      guardrailPassed: true,
    };
  }

  /**
   * Identifies user language (English, Roman Urdu / Urdu, Arabic)
   */
  private detectLanguage(text: string, explicitPref?: 'en' | 'ur' | 'ar'): 'en' | 'ur' | 'ar' {
    if (explicitPref) return explicitPref;

    // Check Arabic unicode block
    if (/[\u0600-\u06FF]/.test(text)) {
      // If contains Urdu specific characters like ے, ٹ, ڈ, ڑ
      if (/[ٹڈڑںےہ]/.test(text)) {
        return 'ur';
      }
      return 'ar';
    }

    // Check Roman Urdu markers
    const romanUrduWords = [
      'kya',
      'hai',
      'hain',
      'mujhe',
      'chahiye',
      'wapsi',
      'paisa',
      'kitne',
      'kaise',
      'hoga',
      'sasta',
      'mehenga',
      'batao',
      'shukriya',
      'mein',
      'aur',
      'dono',
      'acha',
      'kharidna',
      'kitna',
      'par',
    ];
    const lower = text.toLowerCase();
    const tokens = lower.split(/\s+/);
    const matchCount = tokens.filter((t) => romanUrduWords.includes(t)).length;

    if (matchCount >= 1) {
      return 'ur';
    }

    return 'en';
  }

  /**
   * Classifies user intent
   */
  private detectIntent(
    text: string
  ): 'PRODUCT_SEARCH' | 'PRODUCT_COMPARISON' | 'POLICY_INQUIRY' | 'GENERAL_SUPPORT' {
    const lower = text.toLowerCase();

    // Check comparison intent first
    if (
      lower.includes('compare') ||
      lower.includes('vs') ||
      lower.includes('versus') ||
      lower.includes('difference') ||
      lower.includes('muqabla') ||
      lower.includes('dono mein se') ||
      lower.includes('مقارنة') ||
      lower.includes('الفرق')
    ) {
      return 'PRODUCT_COMPARISON';
    }

    // Check policy intent
    const policyKeywords = [
      'return',
      'refund',
      'wapsi',
      'exchange',
      'shipping',
      'delivery',
      'charges',
      'free shipping',
      'cod',
      'cash on delivery',
      'jazzcash',
      'easypaisa',
      'stripe',
      'warranty',
      'guarantee',
      'rma',
      'policy',
      'ارجاع',
      'إرجاع',
      'استرجاع',
      'شحن',
      'توصيل',
      'دفع',
      'ضمان',
    ];
    if (policyKeywords.some((k) => lower.includes(k))) {
      return 'POLICY_INQUIRY';
    }

    // Check search / shopping intent
    const searchKeywords = [
      'laptop',
      'shirt',
      'ultrabook',
      'thinkbook',
      'price',
      'chahiye',
      'recommend',
      'show me',
      'buy',
      'buy online',
      'search',
      'kharidna',
      'find',
      'gaming',
      'workstation',
      'لابتوب',
      'حاسوب',
      'كمبيوتر',
      'شراء',
      'أريد',
      'اريد',
      'بحث',
      'سعر',
      'منتج',
      'مواصفات',
      'قميص',
    ];
    if (searchKeywords.some((k) => lower.includes(k))) {
      return 'PRODUCT_SEARCH';
    }

    return 'GENERAL_SUPPORT';
  }

  /**
   * Retrieves the best grounded store policy using semantic + keyword scoring
   */
  private findBestMatchingPolicy(query: string): StorePolicy {
    const queryLower = query.toLowerCase();
    const queryVector = EmbeddingPipeline.generateEmbedding(queryLower);

    let bestScore = -1;
    let bestPolicy = GROUNDED_STORE_POLICIES[0];

    for (const policy of GROUNDED_STORE_POLICIES) {
      // Keyword match score
      let keywordHits = 0;
      for (const kw of policy.keywords) {
        if (queryLower.includes(kw)) {
          keywordHits++;
        }
      }

      // Semantic similarity against policy title + content
      const policyVector = EmbeddingPipeline.generateEmbedding(
        `${policy.title} ${policy.content}`
      );
      const semanticScore = EmbeddingPipeline.cosineSimilarity(queryVector, policyVector);

      const totalScore = keywordHits * 2.0 + semanticScore;
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestPolicy = policy;
      }
    }

    return bestPolicy;
  }

  /**
   * Formats localized Roman Urdu response for policies
   */
  private formatUrduPolicyReply(policy: StorePolicy): string {
    switch (policy.category) {
      case 'RETURNS':
        return `DeBro ki return policy ke mutabiq: Delivered orders ko 7 din ke andar wapis ya exchange karwa saktay hain. Item undamaged aur original packaging mein hona zaroori hai. Refund 48-72 ghantay mein process ho jata hai.`;
      case 'SHIPPING':
        return `TCS aur Leopards ke zariye pure Pakistan mein delivery 2-3 din mein hoti hai. Rs. 2,999 se zyada ke orders par delivery 100% FREE hai! Warna Rs. 250 flat shipping charge hota hai.`;
      case 'PAYMENTS':
        return `Aap Cash on Delivery (COD), JazzCash, Easypaisa, aur Credit/Debit Cards ke zariye payment kar saktay hain. Rs. 50,000 se baray COD orders par phone verification lazmi hoti hai.`;
      case 'WARRANTY':
        return `Tamam laptops aur tech products 100% genuine hotay hain with official brand warranty. Ultrabook par 12 maah aur ThinkBook par 24 maah ki comprehensive brand warranty shamil hai.`;
      default:
        return policy.content;
    }
  }

  /**
   * Retrieves all available store policies
   */
  public getPolicies(): StorePolicy[] {
    return GROUNDED_STORE_POLICIES;
  }
}

export const aiService = new AIService();
