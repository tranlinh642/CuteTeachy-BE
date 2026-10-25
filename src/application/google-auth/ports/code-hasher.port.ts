export const CODE_HASHER = Symbol('CODE_HASHER');

export interface CodeHasher {
  hash(code: string): string;
}
