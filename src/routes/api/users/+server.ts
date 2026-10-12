import type { RequestHandler } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import {
	users,
	inviteCodes,
	inviteCodeUses,
	albums,
	photos,
	siteSettings
} from '#lib/server/db/schema.js';
import { eq, desc, inArray } from 'drizzle-orm';
import { hashPassword } from '#lib/server/password.js';

// GET /api/users - List users (admin only)
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return Response.json({ error: '沒有權限' }, { status: 403 });
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

	return Response.json({ users: allUsers });
};

// PUT /api/users - Update user role (admin only)
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return Response.json({ error: '沒有權限' }, { status: 403 });
	}

	const { userId, role } = await request.json();

	if (!userId || !role || !['admin', 'viewer'].includes(role)) {
		return Response.json({ error: '無效的參數' }, { status: 400 });
	}

	// Prevent demoting self
	if (userId === locals.user.id && role !== 'admin') {
		return Response.json({ error: '無法變更自己的角色' }, { status: 400 });
	}

	const [updated] = await db
		.update(users)
		.set({ role, updatedAt: new Date() })
		.where(eq(users.id, userId))
		.returning({ id: users.id, role: users.role });

	return Response.json({ user: updated });
};

// POST /api/users - Create user (admin only)
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return Response.json({ error: '沒有權限' }, { status: 403 });
	}

	const { email, password, name, role } = await request.json();

	if (!email || !password) {
		return Response.json({ error: '請輸入電子郵件和密碼' }, { status: 400 });
	}

	if (password.length < 8) {
		return Response.json({ error: '密碼長度至少需要 8 個字元' }, { status: 400 });
	}

	if (!role || !['admin', 'viewer'].includes(role)) {
		return Response.json({ error: '無效的角色' }, { status: 400 });
	}

	const existingUser = await db.query.users.findFirst({
		where: eq(users.email, email)
	});

	if (existingUser) {
		return Response.json({ error: '此電子郵件已被使用' }, { status: 400 });
	}

	const passwordHash = await hashPassword(password);
	const [newUser] = await db
		.insert(users)
		.values({ email, passwordHash, name: name || null, role })
		.returning({
			id: users.id,
			email: users.email,
			name: users.name,
			role: users.role,
			createdAt: users.createdAt
		});

	await db.insert(siteSettings).values({
		key: `must_change_password_${newUser.id}`,
		value: true
	});

	return Response.json({ user: newUser });
};

// DELETE /api/users - Delete user (admin only, cannot delete self)
export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return Response.json({ error: '沒有權限' }, { status: 403 });
	}

	const { userId } = await request.json();

	if (!userId) {
		return Response.json({ error: '無效的參數' }, { status: 400 });
	}

	if (userId === locals.user.id) {
		return Response.json({ error: '無法刪除自己的帳號' }, { status: 400 });
	}

	const userInviteCodes = await db
		.select({ id: inviteCodes.id })
		.from(inviteCodes)
		.where(eq(inviteCodes.createdBy, userId));
	if (userInviteCodes.length > 0) {
		await db.delete(inviteCodeUses).where(
			inArray(
				inviteCodeUses.inviteCodeId,
				userInviteCodes.map((c) => c.id)
			)
		);
	}

	await db.delete(inviteCodeUses).where(eq(inviteCodeUses.userId, userId));

	await db.delete(inviteCodes).where(eq(inviteCodes.createdBy, userId));

	await db.delete(albums).where(eq(albums.ownerId, userId));

	await db.delete(photos).where(eq(photos.uploadedBy, userId));

	await db.delete(siteSettings).where(eq(siteSettings.key, `must_change_password_${userId}`));

	await db.delete(users).where(eq(users.id, userId));

	return Response.json({ success: true });
};
