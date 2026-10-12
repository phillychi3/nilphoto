import { type RequestHandler } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { photos } from '#lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getStorage, getContentType } from '#lib/server/storage/index.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	const photo = await db.query.photos.findFirst({
		where: eq(photos.id, params.id!),
		with: {
			albumPhotos: {
				with: {
					album: { columns: { id: true, isPublic: true } }
				}
			}
		}
	});

	if (!photo) {
		return new Response('圖片不存在', { status: 404 });
	}

	const isUploader = locals.user?.id === photo.uploadedBy;
	const isAdmin = locals.user?.role === 'admin';
	const inPublicAlbum = photo.albumPhotos.some((ap) => ap.album.isPublic);

	if (!inPublicAlbum && !isUploader && !isAdmin) {
		return new Response('沒有權限下載此圖片', { status: 403 });
	}

	const storage = await getStorage();
	const buffer = await storage.download(photo.storagePath);
	const contentType = getContentType(photo.originalFilename);
	const filename = encodeURIComponent(photo.originalFilename);

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
			'Content-Length': String(buffer.length),
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
