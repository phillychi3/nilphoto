import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { photos, photoExif, storageConfigs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getStorage, getDefaultStorageProvider, getContentType } from '$lib/server/storage';
import { processImage } from '$lib/server/services/image';

const IMAGE_EXTENSIONS = new Set([
	'jpg',
	'jpeg',
	'png',
	'gif',
	'webp',
	'avif',
	'heic',
	'heif',
	'tiff'
]);

function isImageKey(key: string): boolean {
	const ext = key.split('.').pop()?.toLowerCase();
	return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '需要管理員權限' }, { status: 403 });
	}

	const body = await request.json().catch(() => ({}));
	const { storageConfigId, prefix = 'photos/' } = body as {
		storageConfigId?: string;
		prefix?: string;
	};

	try {
		const storage = await getStorage(storageConfigId);

		let providerName: 's3' | 'r2' | 'github' | 'local' = 'local';
		if (storageConfigId) {
			const config = await db.query.storageConfigs.findFirst({
				where: eq(storageConfigs.id, storageConfigId)
			});
			providerName = (config?.provider as typeof providerName) ?? 'local';
		} else {
			providerName = await getDefaultStorageProvider();
		}

		const allObjects = await storage.listObjects(prefix);
		const imageObjects = allObjects.filter((obj) => isImageKey(obj.key));

		const existingRows = await db.select({ storagePath: photos.storagePath }).from(photos);
		const existingPaths = new Set(existingRows.map((r) => r.storagePath));

		const newObjects = imageObjects.filter((obj) => !existingPaths.has(obj.key));

		const results = {
			total: imageObjects.length,
			alreadySynced: imageObjects.length - newObjects.length,
			added: 0,
			errors: 0,
			errorDetails: [] as string[]
		};

		for (const obj of newObjects) {
			try {
				const buffer = await storage.download(obj.key);
				const { metadata, thumbnail, exif } = await processImage(buffer);

				const timestamp = Date.now();
				const random = Math.random().toString(36).substring(2, 8);
				const thumbnailKey = `thumbnails/${timestamp}-${random}.jpg`;
				await storage.upload(thumbnailKey, thumbnail.buffer, {
					contentType: 'image/jpeg'
				});

				const filename = obj.key.split('/').pop() || obj.key;
				const mimeType = getContentType(filename);

				const [newPhoto] = await db
					.insert(photos)
					.values({
						uploadedBy: locals.user.id,
						filename,
						originalFilename: filename,
						mimeType,
						size: obj.size,
						storagePath: obj.key,
						thumbnailPath: thumbnailKey,
						storageProvider: providerName,
						width: metadata.width,
						height: metadata.height,
						aspectRatio: metadata.aspectRatio,
						isHdr: metadata.isHdr,
						mediaType: 'photo'
					})
					.returning();

				if (exif) {
					await db.insert(photoExif).values({
						photoId: newPhoto.id,
						cameraMake: exif.cameraMake,
						cameraModel: exif.cameraModel,
						lensModel: exif.lensModel,
						aperture: exif.aperture,
						shutterSpeed: exif.shutterSpeed,
						iso: exif.iso,
						focalLength: exif.focalLength,
						focalLength35mm: exif.focalLength35mm,
						latitude: exif.latitude,
						longitude: exif.longitude,
						altitude: exif.altitude,
						takenAt: exif.takenAt,
						rawExif: exif.rawExif
					});
				}

				results.added++;
			} catch (err) {
				results.errors++;
				results.errorDetails.push(`${obj.key}: ${(err as Error).message}`);
			}
		}

		return json({ success: true, results });
	} catch (err) {
		return json({ error: `同步失敗: ${(err as Error).message}` }, { status: 500 });
	}
};
