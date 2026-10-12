import type { RequestHandler } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { applyPhotoTagChanges } from '#lib/server/services/photo-tags.js';

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

// PATCH /api/photos/tags - Batch add/remove tags on multiple photos
// Body: { photoIds: string[], add?: string[], remove?: string[] }
// Tags not listed in add/remove are left untouched.
export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return Response.json({ error: '請先登入' }, { status: 401 });
	}

	if (locals.user.role !== 'admin') {
		return Response.json({ error: '沒有權限' }, { status: 403 });
	}

	const { photoIds, add = [], remove = [] } = await request.json();

	if (!isStringArray(photoIds) || photoIds.length === 0) {
		return Response.json({ error: '請提供圖片 ID 列表' }, { status: 400 });
	}

	if (!isStringArray(add) || !isStringArray(remove)) {
		return Response.json({ error: '請提供標籤 ID 列表' }, { status: 400 });
	}

	const result = await applyPhotoTagChanges(db, photoIds, add, remove);

	if (!result) {
		return Response.json({ error: '圖片不存在' }, { status: 404 });
	}

	return Response.json({ success: true, ...result });
};
