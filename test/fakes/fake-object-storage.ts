import {
  ObjectStorage,
  PutObjectOptions,
} from '../../src/application/avatar/ports/object-storage.port';

export class FakeObjectStorage implements ObjectStorage {
  private readonly storage = new Map<string, { body: Buffer; contentType: string }>();
  public readonly putCalls: PutObjectOptions[] = [];
  public readonly deleteCalls: { bucket: string; key: string }[] = [];

  constructor(private readonly publicBaseUrl = 'http://localhost:9000/avatars') {}

  async putObject(options: PutObjectOptions): Promise<void> {
    this.putCalls.push({ ...options });
    const storageKey = `${options.bucket}/${options.key}`;
    this.storage.set(storageKey, {
      body: options.body,
      contentType: options.contentType,
    });
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    this.deleteCalls.push({ bucket, key });
    const storageKey = `${bucket}/${key}`;
    this.storage.delete(storageKey);
  }

  getPublicUrl(bucket: string, key: string): string {
    const base = this.publicBaseUrl.replace(/\/+$/, '');
    if (base.endsWith(`/${bucket}`)) {
      return `${base}/${key}`;
    }
    return `${base}/${key}`;
  }

  hasObject(bucket: string, key: string): boolean {
    return this.storage.has(`${bucket}/${key}`);
  }

  getObject(bucket: string, key: string): { body: Buffer; contentType: string } | undefined {
    return this.storage.get(`${bucket}/${key}`);
  }

  clear(): void {
    this.storage.clear();
    this.putCalls.length = 0;
    this.deleteCalls.length = 0;
  }
}
