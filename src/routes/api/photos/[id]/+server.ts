import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { photos, albums } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getStorage } from '$lib/server/storage';

// GET /api/photos/:id - Get photo detail
export const GET: RequestHandler = async ({ params, locals }) => {
	const photo = await db.query.photos.findFirst({
		where: eq(photos.id, params.id!),
		with: {
			exif: true,
			album: true
		}
	});

	if (!photo) {
		return json({ error: '圖片不存在' }, { status: 404 });
	}

	// Check album access
	const album = photo.album;
	const isOwner = locals.user?.id === album.ownerId;
	const isAdmin = locals.user?.role === 'admin';

	if (!album.isPublic && !isOwner && !isAdmin) {
		return json({ error: '沒有權限查看此圖片' }, { status: 403 });
	}

	const storage = await getStorage();
	const [url, thumbnailUrl] = await Promise.all([
		storage.getUrl(photo.storagePath),
		photo.thumbnailPath ? storage.getUrl(photo.thumbnailPath) : Promise.resolve(null)
	]);

	return json({
		photo: {
			...photo,
			url,
			thumbnailUrl
		}
	});
};

// PUT /api/photos/:id - Update photo info
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return json({ error: '請先登入' }, { status: 401 });
	}

	const photo = await db.query.photos.findFirst({
		where: eq(photos.id, params.id!),
		with: { album: true }
	});

	if (!photo) {
		return json({ error: '圖片不存在' }, { status: 404 });
	}

	if (photo.album.ownerId !== locals.user.id && locals.user.role !== 'admin') {
		return json({ error: '沒有權限修改此圖片' }, { status: 403 });
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

	return json({ photo: updated });
};

// DELETE /api/photos/:id - Delete photo
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: '請先登入' }, { status: 401 });
	}

	const photo = await db.query.photos.findFirst({
		where: eq(photos.id, params.id!),
		with: { album: true }
	});

	if (!photo) {
		return json({ error: '圖片不存在' }, { status: 404 });
	}

	if (photo.album.ownerId !== locals.user.id && locals.user.role !== 'admin') {
		return json({ error: '沒有權限刪除此圖片' }, { status: 403 });
	}

	// Delete from storage
	try {
		const storage = await getStorage();
		await storage.delete(photo.storagePath);
		if (photo.thumbnailPath) {
			await storage.delete(photo.thumbnailPath);
		}
	} catch (error) {
		console.error('Failed to delete from storage:', error);
	}

	// Delete from DB (cascade will handle exif)
	await db.delete(photos).where(eq(photos.id, params.id!));

	return json({ success: true });
};
