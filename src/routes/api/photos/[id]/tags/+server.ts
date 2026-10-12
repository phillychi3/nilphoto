import type { RequestHandler } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { photos, photoTags, tags } from '#lib/server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

// PUT /api/photos/:id/tags - Set photo tags (replace all)
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return Response.json({ error: '請先登入' }, { status: 401 });
	}

	if (locals.user.role !== 'admin') {
		return Response.json({ error: '沒有權限' }, { status: 403 });
	}

	const photo = await db.query.photos.findFirst({
		where: eq(photos.id, params.id!)
	});

	if (!photo) {
		return Response.json({ error: '圖片不存在' }, { status: 404 });
	}

	const { tagIds } = await request.json();

	if (!Array.isArray(tagIds)) {
		return Response.json({ error: '請提供標籤 ID 列表' }, { status: 400 });
	}

	// Remove all existing tags
	await db.delete(photoTags).where(eq(photoTags.photoId, params.id!));

	// Add new tags
	if (tagIds.length > 0) {
		// Verify tags exist
		const existingTags = await db.query.tags.findMany({
			where: inArray(tags.id, tagIds),
			columns: { id: true }
		});

		const validIds = existingTags.map((t) => t.id);

		if (validIds.length > 0) {
			await db.insert(photoTags).values(
				validIds.map((tagId) => ({
					photoId: params.id!,
					tagId
				}))
			);
		}
	}

	return Response.json({ success: true });
};
