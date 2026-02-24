/**
 * 儲存服務抽象層類型定義
 */

export interface UploadOptions {
	contentType?: string;
	metadata?: Record<string, string>;
}

export interface UploadResult {
	key: string;
	url: string;
	size: number;
}

export interface UrlOptions {
	/** Signed URL 過期時間 (秒) */
	expiresIn?: number;
}

/**
 * 儲存服務中的物件資訊
 */
export interface StorageObject {
	key: string;
	size: number;
	lastModified?: Date;
}

/**
 * 儲存服務統一介面
 */
export interface StorageAdapter {
	/** 上傳檔案 */
	upload(key: string, data: Buffer, options?: UploadOptions): Promise<UploadResult>;

	/** 下載檔案 */
	download(key: string): Promise<Buffer>;

	/** 刪除檔案 */
	delete(key: string): Promise<void>;

	/** 取得檔案 URL */
	getUrl(key: string, options?: UrlOptions): Promise<string>;

	/** 檢查檔案是否存在 */
	exists(key: string): Promise<boolean>;

	/** 列出指定前綴下的所有物件 */
	listObjects(prefix?: string): Promise<StorageObject[]>;
}

/**
 * S3/R2 設定
 */
export interface S3Config {
	bucket: string;
	region?: string;
	endpoint?: string;
	accessKeyId: string;
	secretAccessKey: string;
	/** 公開 URL 前綴 (用於 CDN) */
	publicUrl?: string;
}

/**
 * 本地儲存設定
 */
export interface LocalConfig {
	/** 檔案儲存路徑 */
	basePath?: string;
	/** URL 前綴 */
	baseUrl?: string;
}

/**
 * 儲存服務提供者類型
 */
export type StorageProvider = 's3' | 'r2' | 'github' | 'local';
