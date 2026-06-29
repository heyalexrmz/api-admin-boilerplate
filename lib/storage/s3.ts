import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Readable } from "node:stream";

export type S3StorageConfig = {
  endpoint?: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
};

export type StoredObjectInput = {
  key: string;
  body: Buffer | Uint8Array | Readable | ReadableStream;
  contentType: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getS3StorageConfig(): S3StorageConfig {
  return {
    endpoint: process.env.S3_ENDPOINT,
    bucket: requiredEnv("S3_BUCKET"),
    region: process.env.S3_REGION ?? "auto",
    accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  };
}

export class S3DocumentStore {
  private readonly client: S3Client;
  readonly bucket: string;

  constructor(config: S3StorageConfig = getS3StorageConfig()) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle ?? true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch (error) {
        const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
        if (metadata?.httpStatusCode !== 409) throw error;
      }
    }
  }

  async put(input: StoredObjectInput): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      },
    });
    await upload.done();
  }

  async getStream(key: string): Promise<ReadableStream | Readable> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    if (!response.Body) throw new Error(`S3 object has no body: ${key}`);
    return response.Body as ReadableStream | Readable;
  }

  async getBuffer(key: string): Promise<Buffer> {
    const stream = await this.getStream(key);
    const chunks: Buffer[] = [];

    if (stream instanceof ReadableStream) {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
      }
    } else {
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    }

    return Buffer.concat(chunks);
  }
}

export function sanitizeObjectKeySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200) || "_";
}

export function documentObjectKey(input: {
  organizationId: string;
  rfc: string;
  ticketId: string;
  documentId: string;
  fileName: string;
}): string {
  const org = sanitizeObjectKeySegment(input.organizationId);
  const rfc = sanitizeObjectKeySegment(input.rfc.toUpperCase());
  const ticket = sanitizeObjectKeySegment(input.ticketId);
  const document = sanitizeObjectKeySegment(input.documentId);
  const fileName = sanitizeObjectKeySegment(input.fileName);
  return `organizations/${org}/taxpayers/${rfc}/tickets/${ticket}/${document}-${fileName}`;
}
