import type { RequestHandler } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { users, siteSettings } from '#lib/server/db/schema.js';
import { verifyPassword } from '#lib/server/password.js';
import { createSession, generateSessionToken, setSessionTokenCookie } from '#lib/server/auth.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { email, password } = await request.json();

	if (!email || !password) {
		return Response.json({ error: '請輸入電子郵件和密碼' }, { status: 400 });
	}

	const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

	if (!user) {
		return Response.json({ error: '電子郵件或密碼錯誤' }, { status: 401 });
	}

	const validPassword = await verifyPassword(user.passwordHash, password);
	if (!validPassword) {
		return Response.json({ error: '電子郵件或密碼錯誤' }, { status: 401 });
	}

	const token = generateSessionToken();
	const session = await createSession(token, user.id);

	setSessionTokenCookie({ cookies } as any, token, session.expiresAt);

	const mustChangeSetting = await db.query.siteSettings.findFirst({
		where: eq(siteSettings.key, `must_change_password_${user.id}`)
	});

	return Response.json({
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role
		},
		mustChangePassword: !!mustChangeSetting
	});
};
