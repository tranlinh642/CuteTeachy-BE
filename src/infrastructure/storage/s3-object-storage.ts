import { Inject, Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
  ObjectStorage,
  PutObjectOptions,
} from '../../application/avatar/ports/object-storage.port';
import { APP_CONFIG, AppConfig } from '../config/app.config';

@Injectable()
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly publicUrlPrefix: string;
  private readonly endpoint: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.endpoint = config.S3_ENDPOINT;
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

  async putObject(options: PutObjectOptions): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
    });

    await this.client.send(command);
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
