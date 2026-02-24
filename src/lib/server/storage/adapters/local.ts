import { mkdir, writeFile, readFile, unlink, access, readdir, stat } from 'fs/promises';
import { dirname, join } from 'path';
import type {
	StorageAdapter,
	StorageObject,
	LocalConfig,
	UploadOptions,
	UploadResult,
	UrlOptions
} from '../types';

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

		await mkdir(dirname(filePath), { recursive: true });

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
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw error;
			}
		}
	}

	async getUrl(key: string, options?: UrlOptions): Promise<string> {
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

	async listObjects(prefix?: string): Promise<StorageObject[]> {
		const objects: StorageObject[] = [];
		const rootPath = this.basePath;

		const scanDir = async (dir: string) => {
			let entries;
			try {
				entries = await readdir(dir, { withFileTypes: true });
			} catch {
				return;
			}
			for (const entry of entries) {
				const fullPath = join(dir, entry.name);
				if (entry.isDirectory()) {
					await scanDir(fullPath);
				} else {
					const key = fullPath.slice(rootPath.length + 1).replace(/\\/g, '/');
					if (!prefix || key.startsWith(prefix)) {
						const stats = await stat(fullPath);
						objects.push({ key, size: stats.size, lastModified: stats.mtime });
					}
				}
			}
		};

		await scanDir(rootPath);
		return objects;
	}
}
