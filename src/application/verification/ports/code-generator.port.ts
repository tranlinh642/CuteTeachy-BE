export const CODE_GENERATOR = Symbol('CODE_GENERATOR');

export interface CodeGenerator {
  generate(): string;
}
