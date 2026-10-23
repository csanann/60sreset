// Count the original input in UTF-16 code units, including surrounding whitespace.
export const MAX_THOUGHT_LENGTH = 2_000;
export const THOUGHT_CONTENT_MESSAGE = 'Try a short thought or feeling in your own words.';

// A conservative format check, not a language/meaning classifier. Ambiguity passes.
export function isClearlyNonMeaningfulThought(thought: string): boolean {
  // Ignore invisible controls for this check only; never rewrite the submitted text.
  const text = thought.replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
  return !text || /^[\p{Nd}\p{P}\s+<=>^`|~$]+$/u.test(text) || /^(x|q)\1{7,}$/i.test(text);
}

export function validateThought(thought: unknown): string | null {
  if (typeof thought !== 'string') return 'Thoughts must be text.';
  if (!thought.trim()) return 'Write a thought before resetting.';
  if (thought.length > MAX_THOUGHT_LENGTH) {
    return `Keep your thoughts to ${MAX_THOUGHT_LENGTH.toLocaleString('en-US')} characters or fewer.`;
  }
  if (isClearlyNonMeaningfulThought(thought)) return THOUGHT_CONTENT_MESSAGE;
  return null;
}

export const REFLECTION_LIMITS = { reflection: 600, perspective: 600, nextStep: 240 } as const;
export const MOCK_LABEL = 'Mock reflection — not AI-generated';
export const GEMINI_LABEL = 'AI reflection — Gemini 2.5 Flash-Lite';
export const SAFETY_LABEL = 'Safety comes first';
export const SAFETY_MESSAGE = 'Your safety matters. A normal reframe may not be appropriate here. If anyone is in immediate danger, contact local emergency services now. If you can, move to a safer place and reach out to someone you trust.';

export type ReflectionContent = {
  reflection: string;
  perspective: string;
  nextStep?: string;
};

export type ModelOutput = ({ kind: 'reflection' } & ReflectionContent) | { kind: 'safety' };
export type ResetResponse =
  | ({ kind: 'reflection'; mock: boolean; label: string } & ReflectionContent)
  | { kind: 'safety'; label: typeof SAFETY_LABEL; message: typeof SAFETY_MESSAGE };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function validText(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
}

export function parseReflection(value: unknown): ReflectionContent | null {
  if (!isRecord(value) || !onlyKeys(value, ['reflection', 'perspective', 'nextStep'])) return null;
  if (!validText(value.reflection, REFLECTION_LIMITS.reflection) ||
      !validText(value.perspective, REFLECTION_LIMITS.perspective)) return null;
  if (Object.hasOwn(value, 'nextStep') && !validText(value.nextStep, REFLECTION_LIMITS.nextStep)) return null;
  return {
    reflection: value.reflection.trim(),
    perspective: value.perspective.trim(),
    ...(typeof value.nextStep === 'string' ? { nextStep: value.nextStep.trim() } : {}),
  };
}

// The model may decline a normal reframe, but may never supply crisis instructions.
export function parseModelOutput(value: unknown): ModelOutput | null {
  if (!isRecord(value)) return null;
  const { kind, ...content } = value;
  if (kind === 'safety' && Object.keys(content).length === 0) return { kind };
  const reflection = kind === 'reflection' ? parseReflection(content) : null;
  return reflection ? { kind: 'reflection', ...reflection } : null;
}

export function parseResetResponse(value: unknown): ResetResponse | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'safety') {
    return onlyKeys(value, ['kind', 'label', 'message']) &&
      value.label === SAFETY_LABEL && value.message === SAFETY_MESSAGE
      ? { kind: 'safety', label: SAFETY_LABEL, message: SAFETY_MESSAGE } : null;
  }
  const { kind, mock, label, ...content } = value;
  if (kind !== 'reflection' || typeof mock !== 'boolean' || typeof label !== 'string' || label !== (mock ? MOCK_LABEL : GEMINI_LABEL)) return null;
  const reflection = parseReflection(content);
  return reflection ? { kind, mock, label, ...reflection } : null;
}

export const RESET_FAILURE_MESSAGES = {
  REQUEST_FAILED: 'Could not get a reflection. Check your connection and try again.',
  DAILY_LIMIT: 'The daily development limit has been reached. Try again after midnight UTC.',
  UNAVAILABLE: 'AI reflections are unavailable. Ask the developer to check the server setup.',
  PROVIDER_TIMEOUT: 'The AI request took too long. You can try again.',
  PROVIDER_FAILURE: 'The AI service could not complete this reset. You can try again.',
  INVALID_OUTPUT: 'The AI response could not be safely validated. You can try again.',
} as const;

export type ResetFailureCode = keyof typeof RESET_FAILURE_MESSAGES;
