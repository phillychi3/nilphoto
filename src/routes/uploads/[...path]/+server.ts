import { error, type RequestHandler } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getStorage } from '$lib/server/storage';

const MIME_TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',
	avif: 'image/avif',
	heic: 'image/heic',
	heif: 'image/heif',
	svg: 'image/svg+xml',
	mp4: 'video/mp4',
	webm: 'video/webm'
};

export const GET: RequestHandler = async ({ params }) => {
	const filePath = params.path;

	if (!filePath || filePath.includes('..')) {
		throw error(400, 'Invalid path');
	}

	const fullPath = join('data/uploads', filePath);
	const ext = filePath.split('.').pop()?.toLowerCase() || '';
	const contentType = MIME_TYPES[ext] || 'application/octet-stream';

	// 嘗試從本地讀取
	try {
		const data = await readFile(fullPath);

		return new Response(new Uint8Array(data), {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch {
		// 本地找不到，嘗試從預設儲存服務下載並代理
	}

	try {
		const storage = await getStorage();
		const data = await storage.download(filePath);

		return new Response(new Uint8Array(data), {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch {
		// 遠端也找不到
	}

	throw error(404, 'File not found');
};
