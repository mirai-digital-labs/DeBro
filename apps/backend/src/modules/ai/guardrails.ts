export interface GuardrailCheckResult {
  safe: boolean;
  sanitizedInput: string;
  flag?: string;
  reason?: string;
}

export class AIGuardrails {
  private static readonly INJECTION_PATTERNS = [
    /ignore (all )?(previous|above) instructions/i,
    /system prompt/i,
    /you are now in (developer|dan|god) mode/i,
    /give me (this for )?(free|10 rupees|0 rupees|discount of 99)/i,
    /override (the )?price/i,
    /reveal (database|credentials|secret|api key)/i,
    /drop table/i,
    /<script>/i,
  ];

  /**
   * Evaluates incoming message against security guardrails.
   */
  public static evaluate(input: string): GuardrailCheckResult {
    const trimmed = input.trim();

    // Check injection signatures
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          safe: false,
          sanitizedInput: trimmed,
          flag: 'PROMPT_INJECTION_ATTEMPT',
          reason: 'Security Violation: Input contains prohibited instruction override or prompt injection attempt.',
        };
      }
    }

    // Length boundary
    if (trimmed.length > 2000) {
      return {
        safe: false,
        sanitizedInput: trimmed.substring(0, 2000),
        flag: 'PAYLOAD_TOO_LARGE',
        reason: 'Input exceeds maximum character boundary (2,000 characters).',
      };
    }

    return {
      safe: true,
      sanitizedInput: trimmed,
    };
  }

  /**
   * Computes approximate token usage for telemetry.
   */
  public static calculateTokens(prompt: string, completion: string) {
    const promptTokens = Math.max(1, Math.ceil(prompt.length / 4));
    const completionTokens = Math.max(1, Math.ceil(completion.length / 4));
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }
}
