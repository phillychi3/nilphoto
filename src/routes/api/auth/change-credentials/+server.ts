import { json, type RequestHandler } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users, siteSettings } from '$lib/server/db/schema';
import { hashPassword, verifyPassword } from '$lib/server/password';

// POST /api/auth/change-credentials - 首次登入更換帳號密碼
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: '請先登入' }, { status: 401 });
	}

	const { newEmail, newPassword, currentPassword } = await request.json();

	if (!newPassword || newPassword.length < 8) {
		return json({ error: '新密碼長度至少需要 8 個字元' }, { status: 400 });
	}

	const currentUser = await db.query.users.findFirst({
		where: eq(users.id, locals.user.id)
	});

	if (!currentUser) {
		return json({ error: '使用者不存在' }, { status: 404 });
	}

	if (currentPassword) {
		const valid = await verifyPassword(currentUser.passwordHash, currentPassword);
		if (!valid) {
			return json({ error: '目前密碼錯誤' }, { status: 400 });
		}
	}

	if (newEmail && newEmail !== currentUser.email) {
		const existing = await db.query.users.findFirst({
			where: eq(users.email, newEmail)
		});
		if (existing) {
			return json({ error: '此電子郵件已被使用' }, { status: 400 });
		}
	}

	const passwordHash = await hashPassword(newPassword);
	await db
		.update(users)
		.set({
			passwordHash,
			email: newEmail || currentUser.email,
			updatedAt: new Date()
		})
		.where(eq(users.id, locals.user.id));

	await db
		.delete(siteSettings)
		.where(eq(siteSettings.key, `must_change_password_${locals.user.id}`));

	return json({ success: true });
};
