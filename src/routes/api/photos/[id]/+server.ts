import type { RequestHandler } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { photos } from '#lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getStorage } from '#lib/server/storage/index.js';

// GET /api/photos/:id - Get photo detail
export const GET: RequestHandler = async ({ params, locals }) => {
	const photo = await db.query.photos.findFirst({
		where: eq(photos.id, params.id!),
		with: {
			exif: true,
			photoTags: {
				with: {
					tag: true
				}
			},
			albumPhotos: {
				with: {
					album: { columns: { id: true, name: true, isPublic: true } }
				}
			}
		}
	});

	if (!photo) {
		return Response.json({ error: '圖片不存在' }, { status: 404 });
	}

	// Check access: admin, uploader, or photo is in a public album
	const isUploader = locals.user?.id === photo.uploadedBy;
	const isAdmin = locals.user?.role === 'admin';
	const inPublicAlbum = photo.albumPhotos.some((ap) => ap.album.isPublic);

	if (!inPublicAlbum && !isUploader && !isAdmin) {
		return Response.json({ error: '沒有權限查看此圖片' }, { status: 403 });
	}

	const storage = await getStorage();
	const [url, thumbnailUrl] = await Promise.all([
		storage.getUrl(photo.storagePath),
		photo.thumbnailPath ? storage.getUrl(photo.thumbnailPath) : Promise.resolve(null)
	]);

	return Response.json({
		photo: {
			...photo,
			albums: photo.albumPhotos.map((ap) => ap.album),
			tags: photo.photoTags.map((photoTag) => photoTag.tag),
			albumPhotos: undefined,
			photoTags: undefined,
			url,
			thumbnailUrl
		}
	});
};

// PUT /api/photos/:id - Update photo info
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return Response.json({ error: '請先登入' }, { status: 401 });
	}

	const photo = await db.query.photos.findFirst({
		where: eq(photos.id, params.id!)
	});

	if (!photo) {
		return Response.json({ error: '圖片不存在' }, { status: 404 });
	}

	if (photo.uploadedBy !== locals.user.id && locals.user.role !== 'admin') {
		return Response.json({ error: '沒有權限修改此圖片' }, { status: 403 });
	}

	const { title, description } = await request.json();

	const [updated] = await db
		.update(photos)
		.set({
			title: title !== undefined ? title : photo.title,
			description: description !== undefined ? description : photo.description,
			updatedAt: new Date()
		})
		.where(eq(photos.id, params.id!))
		.returning();

	return Response.json({ photo: updated });
};

// DELETE /api/photos/:id - Delete photo
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return Response.json({ error: '請先登入' }, { status: 401 });
	}

	const photo = await db.query.photos.findFirst({
		where: eq(photos.id, params.id!)
	});

	if (!photo) {
		return Response.json({ error: '圖片不存在' }, { status: 404 });
	}

	if (photo.uploadedBy !== locals.user.id && locals.user.role !== 'admin') {
		return Response.json({ error: '沒有權限刪除此圖片' }, { status: 403 });
	}

	try {
		const storage = await getStorage();
		await storage.delete(photo.storagePath);
		if (photo.thumbnailPath) {
			await storage.delete(photo.thumbnailPath);
		}
	} catch (error) {
		console.error('Failed to delete from storage:', error);
	}

	// Delete from DB (cascade handles exif, albumPhotos, photoTags)
	await db.delete(photos).where(eq(photos.id, params.id!));

	return Response.json({ success: true });
};
