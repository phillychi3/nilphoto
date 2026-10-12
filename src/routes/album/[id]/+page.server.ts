import type { PageServerLoad } from './$types';
import { db } from '#lib/server/db/index.js';
import { albums, albumPhotos } from '#lib/server/db/schema.js';
import { eq, asc } from 'drizzle-orm';
import { resolvePhotoUrls } from '#lib/server/storage/index.js';

// 頁面資料仍由客戶端從 /api/albums/:id 載入；這裡只在 SSR 時提供 Open Graph 所需的 meta
export const load: PageServerLoad = async ({ params, locals, url }) => {
	const album = await db.query.albums.findFirst({
		where: eq(albums.id, params.id),
		with: { coverPhoto: true }
	});

	if (!album) return { meta: null };

	const isOwner = locals.user?.id === album.ownerId;
	const isAdmin = locals.user?.role === 'admin';
	const hasShareToken = !!album.shareToken && url.searchParams.get('token') === album.shareToken;

	if (!album.isPublic && !isOwner && !isAdmin && !hasShareToken) return { meta: null };

	// 沒有設定封面時，使用相簿中第一張照片
	let cover = album.coverPhoto;
	if (!cover) {
		const first = await db.query.albumPhotos.findFirst({
			where: eq(albumPhotos.albumId, album.id),
			orderBy: [asc(albumPhotos.sortOrder), asc(albumPhotos.addedAt)],
			with: { photo: true }
		});
		cover = first?.photo ?? null;
	}

	let image: string | null = null;
	if (cover) {
		const { url: photoUrl, thumbnailUrl } = await resolvePhotoUrls(
			cover.storagePath,
			cover.thumbnailPath,
			cover.storageProvider
		);
		image = new URL(thumbnailUrl ?? photoUrl, url.origin).href;
	}

	return {
		meta: {
			title: album.name,
			description: album.description ?? '',
			image,
			url: url.href
		}
	};
};
