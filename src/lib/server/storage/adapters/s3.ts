import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
	StorageAdapter,
	StorageObject,
	S3Config,
	UploadOptions,
	UploadResult,
	UrlOptions
} from '../types';

/**
 * S3/R2 儲存 Adapter
 * 支援 AWS S3 和 Cloudflare R2 (都使用 S3 協議)
 */
export class S3Adapter implements StorageAdapter {
	private client: S3Client;
	private bucket: string;
	private publicUrl?: string;

	constructor(config: S3Config) {
		this.client = new S3Client({
			region: config.region || 'auto',
			endpoint: config.endpoint,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey
			},
			// R2 需要這個設定
			forcePathStyle: !!config.endpoint
		});
		this.bucket = config.bucket;
		this.publicUrl = config.publicUrl;
	}

	async upload(key: string, data: Buffer, options?: UploadOptions): Promise<UploadResult> {
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: data,
				ContentType: options?.contentType,
				Metadata: options?.metadata
			})
		);

		return {
			key,
			url: await this.getUrl(key),
			size: data.length
		};
	}

	async download(key: string): Promise<Buffer> {
		const response = await this.client.send(
			new GetObjectCommand({
				Bucket: this.bucket,
				Key: key
			})
		);

		if (!response.Body) {
			throw new Error(`Failed to download file: ${key}`);
		}

		const chunks: Uint8Array[] = [];
		for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
			chunks.push(chunk);
		}
		return Buffer.concat(chunks);
	}

	async delete(key: string): Promise<void> {
		await this.client.send(
			new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: key
			})
		);
	}

	async getUrl(key: string, options?: UrlOptions): Promise<string> {
		if (this.publicUrl && !options?.expiresIn) {
			return `${this.publicUrl}/${key}`;
		}

		const command = new GetObjectCommand({
			Bucket: this.bucket,
			Key: key
		});

		return await getSignedUrl(this.client, command, {
			expiresIn: options?.expiresIn || 3600 // 預設 1 小時
		});
	}

	async exists(key: string): Promise<boolean> {
		try {
			await this.client.send(
				new HeadObjectCommand({
					Bucket: this.bucket,
					Key: key
				})
			);
			return true;
		} catch (error) {
			if ((error as Error).name === 'NotFound') {
				return false;
			}
			throw error;
		}
	}

	async listObjects(prefix?: string): Promise<StorageObject[]> {
		const objects: StorageObject[] = [];
		let continuationToken: string | undefined;

		do {
			const response = await this.client.send(
				new ListObjectsV2Command({
					Bucket: this.bucket,
					Prefix: prefix,
					ContinuationToken: continuationToken
				})
			);

			for (const obj of response.Contents || []) {
				if (obj.Key && obj.Size !== undefined) {
					objects.push({
						key: obj.Key,
						size: obj.Size,
						lastModified: obj.LastModified
					});
				}
			}

			continuationToken = response.NextContinuationToken;
		} while (continuationToken);

		return objects;
	}
}
