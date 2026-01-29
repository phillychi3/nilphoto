import { mkdir, writeFile, readFile, unlink, access } from 'fs/promises';
import { dirname, join } from 'path';
import type { StorageAdapter, LocalConfig, UploadOptions, UploadResult, UrlOptions } from '../types';

/**
 * 本地檔案系統儲存 Adapter
 * 用於開發環境或不需要雲端儲存的場景
 */
export class LocalAdapter implements StorageAdapter {
	private basePath: string;
	private baseUrl: string;

	constructor(config: LocalConfig = {}) {
		this.basePath = config.basePath || 'data/uploads';
		this.baseUrl = config.baseUrl || '/uploads';
	}

	async upload(key: string, data: Buffer, options?: UploadOptions): Promise<UploadResult> {
		const filePath = join(this.basePath, key);

		// 確保目錄存在
		await mkdir(dirname(filePath), { recursive: true });

		// 寫入檔案
		await writeFile(filePath, data);

		return {
			key,
			url: `${this.baseUrl}/${key}`,
			size: data.length
		};
	}

	async download(key: string): Promise<Buffer> {
		const filePath = join(this.basePath, key);
		return await readFile(filePath);
	}

	async delete(key: string): Promise<void> {
		const filePath = join(this.basePath, key);
		try {
			await unlink(filePath);
		} catch (error) {
			// 如果檔案不存在，忽略錯誤
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw error;
			}
		}
	}

	async getUrl(key: string, options?: UrlOptions): Promise<string> {
		// 本地儲存不支援 signed URL，直接返回公開 URL
		return `${this.baseUrl}/${key}`;
	}

	async exists(key: string): Promise<boolean> {
		const filePath = join(this.basePath, key);
		try {
			await access(filePath);
			return true;
		} catch {
			return false;
		}
	}
}
