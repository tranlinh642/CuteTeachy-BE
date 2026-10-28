export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface PutObjectOptions {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
}

export interface ObjectStorage {
  putObject(options: PutObjectOptions): Promise<void>;
  deleteObject(bucket: string, key: string): Promise<void>;
  getPublicUrl(bucket: string, key: string): string;
}
