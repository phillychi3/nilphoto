import { db } from '$lib/server/db';
import { storageConfigs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { S3Adapter } from './adapters/s3';
import { LocalAdapter } from './adapters/local';
import type { StorageAdapter } from './types';

// 導出類型
export type {
	StorageAdapter,
	UploadOptions,
	UploadResult,
	UrlOptions,
	S3Config,
	LocalConfig
} from './types';

// 導出 Adapter 類別
export { S3Adapter } from './adapters/s3';
export { LocalAdapter } from './adapters/local';

/**
 * 取得儲存服務實例
 * @param configId - 指定的儲存設定 ID，如果不指定則使用預設設定
 * @returns StorageAdapter 實例
 */
export async function getStorage(configId?: string): Promise<StorageAdapter> {
	// 如果有指定 configId，查詢該設定
	// 否則查詢預設設定
	const config = configId
		? await db.query.storageConfigs.findFirst({
				where: eq(storageConfigs.id, configId)
			})
		: await db.query.storageConfigs.findFirst({
				where: eq(storageConfigs.isDefault, true)
			});

	// 如果沒有設定，使用本地儲存
	if (!config) {
		return new LocalAdapter({
			basePath: 'data/uploads',
			baseUrl: '/uploads'
		});
	}

	const settings = config.config as Record<string, string>;

	switch (config.provider) {
		case 's3':
		case 'r2':
			return new S3Adapter({
				bucket: settings.bucket,
				region: settings.region,
				endpoint: settings.endpoint,
				accessKeyId: settings.accessKeyId,
				secretAccessKey: settings.secretAccessKey,
				publicUrl: settings.publicUrl
			});

		case 'github':
			// TODO: 實作 GitHub adapter
			throw new Error('GitHub adapter not implemented yet');

		default:
			return new LocalAdapter({
				basePath: 'data/uploads',
				baseUrl: '/uploads'
			});
	}
}

/**
 * 生成唯一的檔案 key
 * @param originalFilename - 原始檔案名稱
 * @param prefix - 路徑前綴 (例如 'photos', 'thumbnails')
 */
export function generateStorageKey(originalFilename: string, prefix = 'uploads'): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	const ext = originalFilename.split('.').pop() || '';
	return `${prefix}/${timestamp}-${random}.${ext}`;
}

/**
 * 根據檔案副檔名取得 MIME type
 */
export function getContentType(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase();
	const mimeTypes: Record<string, string> = {
		// 圖片
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		png: 'image/png',
		gif: 'image/gif',
		webp: 'image/webp',
		avif: 'image/avif',
		heic: 'image/heic',
		heif: 'image/heif',
		// 影片
		mp4: 'video/mp4',
		webm: 'video/webm',
		mov: 'video/quicktime',
		avi: 'video/x-msvideo'
	};
	return mimeTypes[ext || ''] || 'application/octet-stream';
}
