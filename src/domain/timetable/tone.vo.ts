export const TONES = ['pink', 'blue', 'beige', 'lavender', 'rose', 'mint'] as const;
export type Tone = (typeof TONES)[number];

export function isTone(value: unknown): value is Tone {
  return typeof value === 'string' && (TONES as readonly string[]).includes(value);
}
