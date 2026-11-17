import { Router, Request, Response, NextFunction } from 'express';
import { aiService } from './service.js';

export const aiRouter = Router();

/**
 * POST /api/v1/ai/search
 * Hybrid Lexical + Vector Semantic Product Search
 */
aiRouter.post('/ai/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, categorySlug, maxPrice, limit } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: { message: 'query parameter is required and must be a string.' },
      });
    }

    const results = await aiService.hybridSearch(
      query,
      categorySlug,
      maxPrice ? Number(maxPrice) : undefined,
      limit ? Number(limit) : 5
    );

    res.status(200).json({
      success: true,
      data: {
        query,
        count: results.length,
        results,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/ai/compare
 * Head-to-Head Specification Comparison
 */
aiRouter.post('/ai/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slugA, slugB } = req.body;
    if (!slugA || !slugB) {
      return res.status(400).json({
        success: false,
        error: { message: 'Both slugA and slugB are required for product comparison.' },
      });
    }

    const comparison = await aiService.compareProducts(slugA, slugB);
    res.status(200).json({
      success: true,
      data: comparison,
    });
  } catch (err: any) {
    res.status(404).json({
      success: false,
      error: { message: err.message || 'Error executing product comparison.' },
    });
  }
});

/**
 * POST /api/v1/ai/chat
 * Multi-Turn RAG Shopping Assistant with Guardrails & Multilingual Response
 */
aiRouter.post('/ai/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, message, languagePreference } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: { message: 'message is required and must be a string.' },
      });
    }

    const effectiveSessionId = sessionId || `sess_ai_${Date.now()}`;
    const response = await aiService.chat(effectiveSessionId, message, languagePreference);

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/ai/policies
 * Returns Grounded Store Policies
 */
aiRouter.get('/ai/policies', (_req: Request, res: Response) => {
  const policies = aiService.getPolicies();
  res.status(200).json({
    success: true,
    data: {
      count: policies.length,
      policies,
    },
  });
});
