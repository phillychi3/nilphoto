import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { photos, photoExif, albums, albumPhotos } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getStorage, generateStorageKey } from '$lib/server/storage';
import {
	processImage,
	isValidImageType,
	MAX_FILE_SIZE
} from '$lib/server/services/image';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: '請先登入' }, { status: 401 });
	}

	if (locals.user.role !== 'admin') {
		return json({ error: '沒有權限上傳' }, { status: 403 });
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const albumId = formData.get('albumId') as string | null;
		const title = formData.get('title') as string | null;
		const description = formData.get('description') as string | null;

		if (!file) {
			return json({ error: '請選擇檔案' }, { status: 400 });
		}

		if (!isValidImageType(file.type)) {
			return json({ error: '不支援的檔案格式' }, { status: 400 });
		}

		if (file.size > MAX_FILE_SIZE) {
			return json({ error: '檔案大小超過限制 (最大 50MB)' }, { status: 400 });
		}

		// Validate album if provided
		if (albumId) {
			const album = await db.query.albums.findFirst({
				where: eq(albums.id, albumId)
			});

			if (!album) {
				return json({ error: '相簿不存在' }, { status: 404 });
			}

			if (album.ownerId !== locals.user.id && locals.user.role !== 'admin') {
				return json({ error: '沒有權限上傳到此相簿' }, { status: 403 });
			}
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const { metadata, thumbnail, exif } = await processImage(buffer);

		const storage = await getStorage();
		const storageProvider = 'local';

		const originalKey = generateStorageKey(file.name, 'photos');
		const thumbnailKey = generateStorageKey(file.name, 'thumbnails');

		await Promise.all([
			storage.upload(originalKey, buffer, { contentType: file.type }),
			storage.upload(thumbnailKey, thumbnail.buffer, { contentType: 'image/jpeg' })
		]);

		const [newPhoto] = await db
			.insert(photos)
			.values({
				uploadedBy: locals.user.id,
				filename: originalKey.split('/').pop() || file.name,
				originalFilename: file.name,
				mimeType: file.type,
				size: file.size,
				storagePath: originalKey,
				thumbnailPath: thumbnailKey,
				storageProvider,
				width: metadata.width,
				height: metadata.height,
				aspectRatio: metadata.aspectRatio,
				isHdr: metadata.isHdr,
				title: title || null,
				description: description || null,
				mediaType: 'photo'
			})
			.returning();

		// Link to album if provided
		if (albumId) {
			await db.insert(albumPhotos).values({
				albumId,
				photoId: newPhoto.id
			});
		}

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

		const [originalUrl, thumbnailUrl] = await Promise.all([
			storage.getUrl(originalKey),
			storage.getUrl(thumbnailKey)
		]);

		return json({
			photo: {
				id: newPhoto.id,
				filename: newPhoto.filename,
				originalFilename: newPhoto.originalFilename,
				width: newPhoto.width,
				height: newPhoto.height,
				url: originalUrl,
				thumbnailUrl,
				exif: exif
					? {
							camera: exif.cameraModel
								? `${exif.cameraMake || ''} ${exif.cameraModel}`.trim()
								: null,
							lens: exif.lensModel,
							settings: exif.aperture
								? `f/${exif.aperture} ${exif.shutterSpeed || ''} ISO ${exif.iso || ''}`
								: null,
							takenAt: exif.takenAt?.toISOString()
						}
					: null
			}
		});
	} catch (error) {
		console.error('Upload error:', error);
		return json({ error: '上傳失敗' }, { status: 500 });
	}
};
