// Count the original input in UTF-16 code units, including surrounding whitespace.
export const MAX_THOUGHT_LENGTH = 2_000;

export function validateThought(thought: unknown): string | null {
  if (typeof thought !== 'string') return 'Thoughts must be text.';
  if (!thought.trim()) return 'Write a thought before resetting.';
  if (thought.length > MAX_THOUGHT_LENGTH) {
    return `Keep your thoughts to ${MAX_THOUGHT_LENGTH.toLocaleString('en-US')} characters or fewer.`;
  }
  return null;
}

export type MockReflection = {
  mock: true;
  label: string;
  reflection: string;
};
