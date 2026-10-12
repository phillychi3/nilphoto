import { db } from '#lib/server/db/index.js';
import { storageConfigs } from '#lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { S3Adapter } from './adapters/s3';
import { LocalAdapter } from './adapters/local';
import type { StorageAdapter } from './types';

export type {
	StorageAdapter,
	StorageObject,
	UploadOptions,
	UploadResult,
	UrlOptions,
	S3Config,
	LocalConfig
} from './types';

export { S3Adapter } from './adapters/s3';
export { LocalAdapter } from './adapters/local';

/**
 * 取得儲存服務
 * @param configId - 指定的儲存設定 ID，如果不指定則使用預設設定
 * @returns StorageAdapter 實例
 */
export async function getStorage(configId?: string): Promise<StorageAdapter> {
	const config = configId
		? await db.query.storageConfigs.findFirst({
				where: eq(storageConfigs.id, configId)
			})
		: await db.query.storageConfigs.findFirst({
				where: eq(storageConfigs.isDefault, true)
			});

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
			throw new Error('GitHub adapter not implemented yet');

		default:
			return new LocalAdapter({
				basePath: 'data/uploads',
				baseUrl: '/uploads'
			});
	}
}

/**
 * 取得目前預設的儲存服務提供者名稱
 */
export async function getDefaultStorageProvider(): Promise<'s3' | 'r2' | 'github' | 'local'> {
	const config = await db.query.storageConfigs.findFirst({
		where: eq(storageConfigs.isDefault, true)
	});
	return config?.provider || 'local';
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
 * 解析照片的實際 URL
 * 若儲存提供者為 S3/R2，則透過儲存服務取得直連連結（若設定了 publicUrl 則為直連，否則為簽名 URL）
 * 否則回傳本地代理路徑 /uploads/...
 */
export async function resolvePhotoUrls(
	storagePath: string,
	thumbnailPath: string | null,
	storageProvider: string,
	cachedStorage?: StorageAdapter | null
): Promise<{ url: string; thumbnailUrl: string | null }> {
	if (storageProvider === 's3' || storageProvider === 'r2') {
		const storage = cachedStorage ?? (await getStorage());
		const [url, thumbnailUrl] = await Promise.all([
			storage.getUrl(storagePath),
			thumbnailPath ? storage.getUrl(thumbnailPath) : Promise.resolve(null)
		]);
		return { url, thumbnailUrl };
	}

	return {
		url: `/uploads/${storagePath}`,
		thumbnailUrl: thumbnailPath ? `/uploads/${thumbnailPath}` : null
	};
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
