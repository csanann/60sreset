// Server-only orchestration, kept outside src/app so tests can inject dependencies.
import { BudgetError, reserveGeminiCall } from './gemini-budget.ts';
import { GeminiError, generateGeminiReflection } from './gemini.ts';
import {
  GEMINI_LABEL, MOCK_LABEL, parseModelOutput, RESET_FAILURE_MESSAGES,
  type ResetFailureCode, type ResetResponse, SAFETY_LABEL, SAFETY_MESSAGE,
} from './reset-contract.ts';
import { containsUnsafeAdvice, needsSafetySupport } from './reset-safety.ts';

export class ResetServiceError extends Error {
  readonly code: ResetFailureCode;
  readonly status: number;
  constructor(code: ResetFailureCode, status: number) {
    super(RESET_FAILURE_MESSAGES[code]);
    this.code = code;
    this.status = status;
  }
}

type Configuration = { provider: string; development: boolean; apiKey?: string };
type Dependencies = {
  configuration: () => Configuration;
  reserve: () => Promise<void>;
  generate: typeof generateGeminiReflection;
};

const safetyResponse = (): ResetResponse => ({ kind: 'safety', label: SAFETY_LABEL, message: SAFETY_MESSAGE });

export function createResetService(overrides: Partial<Dependencies> = {}) {
  const dependencies: Dependencies = {
    configuration: () => ({
      provider: process.env.RESET_PROVIDER ?? 'mock',
      development: process.env.NODE_ENV === 'development',
      apiKey: process.env.GEMINI_API_KEY,
    }),
    reserve: () => reserveGeminiCall(),
    generate: generateGeminiReflection,
    ...overrides,
  };
  return async function resetThought(thought: string, signal?: AbortSignal): Promise<ResetResponse> {
    // Run before configuration, quota or network access, including in mock mode.
    if (needsSafetySupport(thought)) return safetyResponse();
    const config = dependencies.configuration();
    if (config.provider === 'mock') {
      return {
        kind: 'reflection', mock: true, label: MOCK_LABEL,
        reflection: 'Take a slow breath. You do not need to untangle everything at once.',
        perspective: 'This is a fixed demo perspective, not an analysis of your thought.',
        nextStep: 'Choose one small next step and give yourself permission to pause.',
      };
    }
    if (config.provider !== 'gemini' || !config.development || !config.apiKey?.trim()) {
      throw new ResetServiceError('UNAVAILABLE', 503);
    }
    try {
      if (signal?.aborted) throw new ResetServiceError('PROVIDER_TIMEOUT', 504);
      await dependencies.reserve();
      if (signal?.aborted) throw new ResetServiceError('PROVIDER_TIMEOUT', 504);
      const output = parseModelOutput(await dependencies.generate(thought, { apiKey: config.apiKey, signal }));
      if (!output) throw new ResetServiceError('INVALID_OUTPUT', 502);
      if (output.kind === 'safety') return safetyResponse();
      const fields = [output.reflection, output.perspective, output.nextStep ?? ''];
      const text = fields.join(' ');
      if (fields.some(containsUnsafeAdvice) || containsUnsafeAdvice(text) || needsSafetySupport(text)) {
        return safetyResponse();
      }
      return { ...output, mock: false, label: GEMINI_LABEL };
    } catch (error) {
      if (error instanceof ResetServiceError) throw error;
      if (error instanceof BudgetError) throw new ResetServiceError(error.code, error.code === 'DAILY_LIMIT' ? 429 : 503);
      if (error instanceof GeminiError) {
        if (error.code === 'PROVIDER_BLOCKED') return safetyResponse();
        throw new ResetServiceError(error.code, error.code === 'PROVIDER_TIMEOUT' ? 504 : 502);
      }
      throw new ResetServiceError('UNAVAILABLE', 503);
    }
  };
}

export const resetThought = createResetService();
