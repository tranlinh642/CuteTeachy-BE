export const TAG_TONES = ['pink', 'blue', 'beige', 'lavender', 'rose', 'mint'] as const;
export type TagTone = (typeof TAG_TONES)[number];

export function isTagTone(value: unknown): value is TagTone {
  return typeof value === 'string' && (TAG_TONES as readonly string[]).includes(value);
}
