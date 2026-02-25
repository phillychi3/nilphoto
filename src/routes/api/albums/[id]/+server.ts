import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { albums, albumPhotos } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { resolvePhotoUrls, getStorage } from '$lib/server/storage';

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

	const isOwner = locals.user?.id === album.ownerId;
	const isAdmin = locals.user?.role === 'admin';
	const hasShareToken = shareToken === album.shareToken;

	if (!album.isPublic && !isOwner && !isAdmin && !hasShareToken) {
		return json({ error: '沒有權限查看此相簿' }, { status: 403 });
	}

	// Get photos through album_photos junction
	const links = await db.query.albumPhotos.findMany({
		where: eq(albumPhotos.albumId, id!),
		orderBy: [asc(albumPhotos.sortOrder), asc(albumPhotos.addedAt)],
		with: {
			photo: {
				with: {
					exif: true
				}
			}
		}
	});

	const storage = links.length > 0 ? await getStorage() : null;

	const photosWithUrls = await Promise.all(
		links.map(async (link) => {
			const photo = link.photo;
			const { url: resolvedUrl, thumbnailUrl } = await resolvePhotoUrls(
				photo.storagePath,
				photo.thumbnailPath,
				photo.storageProvider,
				storage
			);
			return { ...photo, url: resolvedUrl, thumbnailUrl };
		})
	);

	return json({
		album,
		photos: photosWithUrls,
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
		// System albums must stay public
		if (album.isSystem) {
			updateData.isPublic = true;
		} else {
			updateData.isPublic = Boolean(isPublic);
		}
	}

	if (coverPhotoId !== undefined) {
		if (coverPhotoId !== null) {
			// Validate cover photo is in this album
			const link = await db.query.albumPhotos.findFirst({
				where: (ap, { and, eq }) => and(eq(ap.albumId, id!), eq(ap.photoId, coverPhotoId))
			});
			if (!link) {
				return json({ error: '封面圖片不存在於此相簿' }, { status: 400 });
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

	if (album.isSystem) {
		return json({ error: '系統相簿無法刪除' }, { status: 403 });
	}

	if (album.ownerId !== locals.user.id && locals.user.role !== 'admin') {
		return json({ error: '沒有權限刪除此相簿' }, { status: 403 });
	}

	// Delete album (album_photos links cascade, photos themselves remain)
	await db.delete(albums).where(eq(albums.id, id!));

	return json({ success: true });
};
