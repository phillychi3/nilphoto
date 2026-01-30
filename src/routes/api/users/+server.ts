import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/users - List users (admin only)
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const allUsers = await db.query.users.findMany({
		orderBy: [desc(users.createdAt)],
		columns: {
			id: true,
			email: true,
			name: true,
			role: true,
			createdAt: true
		}
	});

	return json({ users: allUsers });
};

// PUT /api/users - Update user role (admin only)
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const { userId, role } = await request.json();

	if (!userId || !role || !['admin', 'viewer'].includes(role)) {
		return json({ error: '無效的參數' }, { status: 400 });
	}

	// Prevent demoting self
	if (userId === locals.user.id && role !== 'admin') {
		return json({ error: '無法變更自己的角色' }, { status: 400 });
	}

	const [updated] = await db
		.update(users)
		.set({ role, updatedAt: new Date() })
		.where(eq(users.id, userId))
		.returning({ id: users.id, role: users.role });

	return json({ user: updated });
};
