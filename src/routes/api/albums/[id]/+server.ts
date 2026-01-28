import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { albums, photos } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';

// GET /api/albums/:id - Get album with photos
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const { id } = params;
	const shareToken = url.searchParams.get('token');

	const album = await db.query.albums.findFirst({
		where: eq(albums.id, id!),
		with: {
			owner: {
				columns: {
					id: true,
					name: true
				}
			},
			coverPhoto: true
		}
	});

	if (!album) {
		return json({ error: '相簿不存在' }, { status: 404 });
	}

	// Check access permissions
	const isOwner = locals.user?.id === album.ownerId;
	const isAdmin = locals.user?.role === 'admin';
	const hasShareToken = shareToken === album.shareToken;

	if (!album.isPublic && !isOwner && !isAdmin && !hasShareToken) {
		return json({ error: '沒有權限查看此相簿' }, { status: 403 });
	}

	// Get photos for this album
	const albumPhotos = await db.query.photos.findMany({
		where: eq(photos.albumId, id!),
		orderBy: [asc(photos.sortOrder), asc(photos.createdAt)],
		with: {
			exif: true
		}
	});

	return json({
		album,
		photos: albumPhotos,
		canEdit: isOwner || isAdmin
	});
};

// PUT /api/albums/:id - Update album
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const { id } = params;

	if (!locals.user) {
		return json({ error: '請先登入' }, { status: 401 });
	}

	const album = await db.query.albums.findFirst({
		where: eq(albums.id, id!)
	});

	if (!album) {
		return json({ error: '相簿不存在' }, { status: 404 });
	}

	// Check ownership
	if (album.ownerId !== locals.user.id && locals.user.role !== 'admin') {
		return json({ error: '沒有權限修改此相簿' }, { status: 403 });
	}

	const { name, description, isPublic, coverPhotoId } = await request.json();

	const updateData: Record<string, unknown> = {
		updatedAt: new Date()
	};

	if (name !== undefined) {
		if (typeof name !== 'string' || name.trim().length === 0) {
			return json({ error: '相簿名稱不可為空' }, { status: 400 });
		}
		updateData.name = name.trim();
	}

	if (description !== undefined) {
		updateData.description = description?.trim() || null;
	}

	if (isPublic !== undefined) {
		updateData.isPublic = Boolean(isPublic);
	}

	if (coverPhotoId !== undefined) {
		// Validate cover photo exists and belongs to this album
		if (coverPhotoId !== null) {
			const coverPhoto = await db.query.photos.findFirst({
				where: and(eq(photos.id, coverPhotoId), eq(photos.albumId, id!))
			});
			if (!coverPhoto) {
				return json({ error: '封面圖片不存在' }, { status: 400 });
			}
		}
		updateData.coverPhotoId = coverPhotoId;
	}

	const [updatedAlbum] = await db
		.update(albums)
		.set(updateData)
		.where(eq(albums.id, id!))
		.returning();

	return json({ album: updatedAlbum });
};

// DELETE /api/albums/:id - Delete album
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { id } = params;

	if (!locals.user) {
		return json({ error: '請先登入' }, { status: 401 });
	}

	const album = await db.query.albums.findFirst({
		where: eq(albums.id, id!)
	});

	if (!album) {
		return json({ error: '相簿不存在' }, { status: 404 });
	}

	// Check ownership
	if (album.ownerId !== locals.user.id && locals.user.role !== 'admin') {
		return json({ error: '沒有權限刪除此相簿' }, { status: 403 });
	}

	// Delete album (photos will be cascade deleted due to schema)
	await db.delete(albums).where(eq(albums.id, id!));

	return json({ success: true });
};
