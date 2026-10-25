import { CodeGenerator } from '../../src/application/verification/ports/code-generator.port';

export class FakeCodeGenerator implements CodeGenerator {
  constructor(private code: string = '123456') {}

  generate(): string {
    return this.code;
  }

  setCode(code: string): void {
    this.code = code;
  }
}
