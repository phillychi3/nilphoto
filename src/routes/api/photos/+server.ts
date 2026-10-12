import type { RequestHandler } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { photos, photoExif, photoTags } from '#lib/server/db/schema.js';
import { desc, count, like, or, and, eq, gte, lte, inArray, sql } from 'drizzle-orm';

// GET /api/photos - List/search photos (admin only)
// Query params:
//   page, limit - pagination
//   q - text search (title, description, filename)
//   camera - camera make/model filter
//   dateFrom, dateTo - date range (ISO string, filters on exif takenAt)
//   isoMin, isoMax - ISO range
//   tag - tag name filter
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return Response.json({ error: '請先登入' }, { status: 401 });
	}

	if (locals.user.role !== 'admin') {
		return Response.json({ error: '沒有權限' }, { status: 403 });
	}

	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
	const offset = (page - 1) * limit;

	// Search filters
	const q = url.searchParams.get('q')?.trim();
	const camera = url.searchParams.get('camera')?.trim();
	const dateFrom = url.searchParams.get('dateFrom');
	const dateTo = url.searchParams.get('dateTo');
	const isoMin = url.searchParams.get('isoMin');
	const isoMax = url.searchParams.get('isoMax');
	const tagFilter = url.searchParams.get('tag')?.trim();

	const hasFilters = q || camera || dateFrom || dateTo || isoMin || isoMax || tagFilter;

	if (!hasFilters) {
		// No filters - simple query
		const allPhotos = await db.query.photos.findMany({
			orderBy: [desc(photos.createdAt)],
			limit,
			offset,
			with: {
				exif: true,
				albumPhotos: {
					with: {
						album: {
							columns: { id: true, name: true }
						}
					}
				},
				photoTags: {
					with: {
						tag: true
					}
				}
			}
		});

		const [{ value: total }] = await db.select({ value: count() }).from(photos);

		return Response.json({
			photos: allPhotos.map((p) => ({
				...p,
				albums: p.albumPhotos.map((ap) => ap.album),
				tags: p.photoTags.map((pt) => pt.tag),
				albumPhotos: undefined,
				photoTags: undefined
			})),
			page,
			limit,
			total,
			hasMore: offset + allPhotos.length < total
		});
	}

	// Build WHERE conditions using SQL for filtered query
	const conditions = [];

	// Text search
	if (q) {
		const pattern = `%${q}%`;
		conditions.push(
			or(
				like(photos.title, pattern),
				like(photos.description, pattern),
				like(photos.originalFilename, pattern)
			)
		);
	}

	// Camera filter (join with exif)
	if (camera) {
		const cameraPattern = `%${camera}%`;
		conditions.push(
			sql`${photos.id} IN (
				SELECT ${photoExif.photoId} FROM ${photoExif}
				WHERE ${like(photoExif.cameraMake, cameraPattern)}
				OR ${like(photoExif.cameraModel, cameraPattern)}
				OR ${like(photoExif.lensModel, cameraPattern)}
			)`
		);
	}

	// Date range filter (exif takenAt)
	if (dateFrom) {
		const fromTs = Math.floor(new Date(dateFrom).getTime() / 1000);
		conditions.push(
			sql`${photos.id} IN (
				SELECT ${photoExif.photoId} FROM ${photoExif}
				WHERE ${photoExif.takenAt} >= ${fromTs}
			)`
		);
	}
	if (dateTo) {
		const toTs = Math.floor(new Date(dateTo + 'T23:59:59').getTime() / 1000);
		conditions.push(
			sql`${photos.id} IN (
				SELECT ${photoExif.photoId} FROM ${photoExif}
				WHERE ${photoExif.takenAt} <= ${toTs}
			)`
		);
	}

	// ISO range
	if (isoMin) {
		conditions.push(
			sql`${photos.id} IN (
				SELECT ${photoExif.photoId} FROM ${photoExif}
				WHERE ${photoExif.iso} >= ${parseInt(isoMin)}
			)`
		);
	}
	if (isoMax) {
		conditions.push(
			sql`${photos.id} IN (
				SELECT ${photoExif.photoId} FROM ${photoExif}
				WHERE ${photoExif.iso} <= ${parseInt(isoMax)}
			)`
		);
	}

	// Tag filter
	if (tagFilter) {
		const tagPattern = `%${tagFilter}%`;
		conditions.push(
			sql`${photos.id} IN (
				SELECT ${photoTags.photoId} FROM ${photoTags}
				INNER JOIN tags ON tags.id = ${photoTags.tagId}
				WHERE tags.name LIKE ${tagPattern}
			)`
		);
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Count total matching
	const [{ value: total }] = await db.select({ value: count() }).from(photos).where(whereClause);

	// Fetch matching photos
	const matchingPhotos = await db.query.photos.findMany({
		where: whereClause,
		orderBy: [desc(photos.createdAt)],
		limit,
		offset,
		with: {
			exif: true,
			albumPhotos: {
				with: {
					album: {
						columns: { id: true, name: true }
					}
				}
			},
			photoTags: {
				with: {
					tag: true
				}
			}
		}
	});

	return Response.json({
		photos: matchingPhotos.map((p) => ({
			...p,
			albums: p.albumPhotos.map((ap) => ap.album),
			tags: p.photoTags.map((pt) => pt.tag),
			albumPhotos: undefined,
			photoTags: undefined
		})),
		page,
		limit,
		total,
		hasMore: offset + matchingPhotos.length < total
	});
};
