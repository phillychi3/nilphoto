import type { RequestHandler } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { albums, albumPhotos, photos } from '#lib/server/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

// POST /api/albums/:id/photos - Add photos to album
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return Response.json({ error: '請先登入' }, { status: 401 });
	}

	const { id } = params;

	const album = await db.query.albums.findFirst({
		where: eq(albums.id, id!)
	});

	if (!album) {
		return Response.json({ error: '相簿不存在' }, { status: 404 });
	}

	if (album.ownerId !== locals.user.id && locals.user.role !== 'admin') {
		return Response.json({ error: '沒有權限' }, { status: 403 });
	}

	const { photoIds } = await request.json();

	if (!Array.isArray(photoIds) || photoIds.length === 0) {
		return Response.json({ error: '請提供照片 ID' }, { status: 400 });
	}

	// Verify photos exist
	const existingPhotos = await db.query.photos.findMany({
		where: inArray(photos.id, photoIds),
		columns: { id: true }
	});

	const validIds = existingPhotos.map((p) => p.id);

	// Check which are already linked
	const existingLinks = await db.query.albumPhotos.findMany({
		where: and(eq(albumPhotos.albumId, id!), inArray(albumPhotos.photoId, validIds)),
		columns: { photoId: true }
	});

	const linkedIds = new Set(existingLinks.map((l) => l.photoId));
	const newIds = validIds.filter((pid) => !linkedIds.has(pid));

	if (newIds.length > 0) {
		await db.insert(albumPhotos).values(
			newIds.map((photoId) => ({
				albumId: id!,
				photoId
			}))
		);
	}

	return Response.json({ added: newIds.length });
};

// DELETE /api/albums/:id/photos - Remove photos from album
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return Response.json({ error: '請先登入' }, { status: 401 });
	}

	const { id } = params;

	const album = await db.query.albums.findFirst({
		where: eq(albums.id, id!)
	});

	if (!album) {
		return Response.json({ error: '相簿不存在' }, { status: 404 });
	}

	if (album.ownerId !== locals.user.id && locals.user.role !== 'admin') {
		return Response.json({ error: '沒有權限' }, { status: 403 });
	}

	const { photoIds } = await request.json();

	if (!Array.isArray(photoIds) || photoIds.length === 0) {
		return Response.json({ error: '請提供照片 ID' }, { status: 400 });
	}

	await db
		.delete(albumPhotos)
		.where(and(eq(albumPhotos.albumId, id!), inArray(albumPhotos.photoId, photoIds)));

	return Response.json({ success: true });
};
