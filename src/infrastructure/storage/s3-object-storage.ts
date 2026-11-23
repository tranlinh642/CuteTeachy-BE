import { Inject, Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import {
  ObjectStorage,
  PutObjectOptions,
  StoredObjectData,
} from '../../application/avatar/ports/object-storage.port';
import { APP_CONFIG, AppConfig } from '../config/app.config';

function isLocalhostEndpoint(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    );
  } catch {
    return false;
  }
}

@Injectable()
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly publicUrlPrefix: string;
  private readonly endpoint: string;
  private readonly configured: boolean;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.endpoint = config.S3_ENDPOINT;
    this.configured = !(
      config.NODE_ENV === 'production' && isLocalhostEndpoint(this.endpoint)
    );
    this.publicUrlPrefix =
      config.S3_PUBLIC_URL_PREFIX ||
      config.S3_PUBLIC_BASE_URL ||
      `${this.endpoint.replace(/\/+$/, '')}/${config.S3_BUCKET || config.S3_BUCKET_AVATARS || 'avatars'}`;

    this.client = new S3Client({
      endpoint: this.endpoint,
      region: config.S3_REGION,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async putObject(options: PutObjectOptions): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
    });

    await this.client.send(command);
  }

  async getObjectBuffer(bucket: string, key: string): Promise<StoredObjectData | null> {
    if (!this.configured) {
      return null;
    }
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      const response = await this.client.send(command);
      if (!response.Body) {
        return null;
      }
      const bytes = await response.Body.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: response.ContentType,
      };
    } catch {
      return null;
    }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  getPublicUrl(bucket: string, key: string): string {
    const base = this.publicUrlPrefix.replace(/\/+$/, '');
    return `${base}/${key}`;
  }
}
