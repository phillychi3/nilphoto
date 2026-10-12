import type { RequestHandler } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { tags } from '#lib/server/db/schema.js';
import { asc } from 'drizzle-orm';

// GET /api/tags - List all tags
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return Response.json({ error: '請先登入' }, { status: 401 });
	}

	const allTags = await db.query.tags.findMany({
		orderBy: [asc(tags.name)]
	});

	return Response.json({ tags: allTags });
};

// POST /api/tags - Create tag
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return Response.json({ error: '請先登入' }, { status: 401 });
	}

	if (locals.user.role !== 'admin') {
		return Response.json({ error: '沒有權限' }, { status: 403 });
	}

	const { name } = await request.json();

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		return Response.json({ error: '請輸入標籤名稱' }, { status: 400 });
	}

	try {
		const [newTag] = await db.insert(tags).values({ name: name.trim() }).returning();

		return Response.json({ tag: newTag }, { status: 201 });
	} catch {
		return Response.json({ error: '標籤已存在' }, { status: 409 });
	}
};
