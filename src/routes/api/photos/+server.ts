import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { photos } from '$lib/server/db/schema';
import { desc, count } from 'drizzle-orm';

// GET /api/photos - List all photos (admin only)
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: '請先登入' }, { status: 401 });
	}

	if (locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
	const offset = (page - 1) * limit;

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

	return json({
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
};
