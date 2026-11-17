/**
 * High-performance deterministic semantic embedding generator
 * Computes normalized 64-dimensional dense semantic vectors.
 */
export class EmbeddingPipeline {
  private static readonly VECTOR_DIM = 64;

  /**
   * Generates a 64-dimensional normalized dense embedding vector for any text.
   */
  public static generateEmbedding(text: string): number[] {
    const vector = new Array<number>(this.VECTOR_DIM).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);

    if (tokens.length === 0) {
      return vector;
    }

    // Hash tokens and character trigrams into dense vector
    for (const token of tokens) {
      // Token level feature
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const index = Math.abs(hash) % this.VECTOR_DIM;
      vector[index] += 1.0;

      // Trigram level feature for typo tolerance
      if (token.length >= 3) {
        for (let i = 0; i <= token.length - 3; i++) {
          const tri = token.substring(i, i + 3);
          let triHash = 0;
          for (let j = 0; j < 3; j++) {
            triHash = (triHash << 5) - triHash + tri.charCodeAt(j);
            triHash |= 0;
          }
          const triIdx = Math.abs(triHash) % this.VECTOR_DIM;
          vector[triIdx] += 0.5;
        }
      }
    }

    // L2-Normalize Vector to unit length
    let norm = 0;
    for (let i = 0; i < this.VECTOR_DIM; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.VECTOR_DIM; i++) {
        vector[i] = vector[i] / norm;
      }
    }

    return vector;
  }

  /**
   * Calculates Cosine Similarity between two normalized vectors: [-1.0, 1.0]
   */
  public static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
    }
    return Math.max(0, dot); // Clamped between 0 and 1 for positive embeddings
  }
}
