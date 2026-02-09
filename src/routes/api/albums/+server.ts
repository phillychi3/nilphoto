import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { albums, albumPhotos } from '$lib/server/db/schema';
import { eq, desc, or, and, asc } from 'drizzle-orm';

function generateShareToken(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

// GET /api/albums - List albums
// ?system=featured - Get featured system album with photos
// ?includePrivate=true - Include private albums (admin/owner)
export const GET: RequestHandler = async ({ locals, url }) => {
	const system = url.searchParams.get('system');

	// Return featured system album photos
	if (system === 'featured') {
		const featured = await db.query.albums.findFirst({
			where: and(eq(albums.isSystem, true), eq(albums.name, '精選'))
		});

		if (!featured) {
			return json({ album: null, photos: [] });
		}

		const links = await db.query.albumPhotos.findMany({
			where: eq(albumPhotos.albumId, featured.id),
			orderBy: [asc(albumPhotos.sortOrder), asc(albumPhotos.addedAt)],
			with: {
				photo: {
					with: { exif: true }
				}
			}
		});

		return json({
			album: featured,
			photos: links.map((l) => l.photo)
		});
	}

	const includePrivate = url.searchParams.get('includePrivate') === 'true';

	let whereClause;

	if (locals.user) {
		if (includePrivate && locals.user.role === 'admin') {
			whereClause = undefined;
		} else if (includePrivate) {
			whereClause = or(eq(albums.isPublic, true), eq(albums.ownerId, locals.user.id));
		} else {
			whereClause = eq(albums.isPublic, true);
		}
	} else {
		whereClause = eq(albums.isPublic, true);
	}

	const albumList = await db.query.albums.findMany({
		where: whereClause,
		orderBy: [desc(albums.createdAt)],
		with: {
			coverPhoto: true,
			owner: {
				columns: {
					id: true,
					name: true
				}
			}
		}
	});

	return json({ albums: albumList });
};

// POST /api/albums - Create album
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: '請先登入' }, { status: 401 });
	}

	if (locals.user.role !== 'admin') {
		return json({ error: '沒有權限建立相簿' }, { status: 403 });
	}

	const { name, description, isPublic } = await request.json();

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return json({ error: '請輸入相簿名稱' }, { status: 400 });
	}

	const [newAlbum] = await db
		.insert(albums)
		.values({
			name: name.trim(),
			description: description?.trim() || null,
			isPublic: isPublic ?? false,
			shareToken: generateShareToken(),
			ownerId: locals.user.id
		})
		.returning();

	return json({ album: newAlbum }, { status: 201 });
};
