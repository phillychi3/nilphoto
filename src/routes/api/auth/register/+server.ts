import type { RequestHandler } from '@sveltejs/kit';
import { eq, and, gt, or, isNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { users, inviteCodes, inviteCodeUses, siteSettings } from '#lib/server/db/schema.js';
import { hashPassword } from '#lib/server/password.js';
import { createSession, generateSessionToken, setSessionTokenCookie } from '#lib/server/auth.js';

type RegistrationMode = 'open' | 'invite_only' | 'closed';

async function getRegistrationMode(): Promise<RegistrationMode> {
	const setting = await db.query.siteSettings.findFirst({
		where: eq(siteSettings.key, 'registration_mode')
	});
	return (setting?.value as RegistrationMode) || 'open';
}

async function validateInviteCode(
	code: string
): Promise<{ valid: boolean; codeId?: string; error?: string }> {
	const inviteCode = await db.query.inviteCodes.findFirst({
		where: and(eq(inviteCodes.code, code), eq(inviteCodes.isActive, true))
	});

	if (!inviteCode) {
		return { valid: false, error: '邀請碼無效' };
	}

	// Check expiration
	if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
		return { valid: false, error: '邀請碼已過期' };
	}

	// Check usage limit
	if (inviteCode.maxUses && inviteCode.usedCount && inviteCode.usedCount >= inviteCode.maxUses) {
		return { valid: false, error: '邀請碼已達使用上限' };
	}

	return { valid: true, codeId: inviteCode.id };
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { email, password, name, inviteCode } = await request.json();

	// Validate input
	if (!email || !password) {
		return Response.json({ error: '請輸入電子郵件和密碼' }, { status: 400 });
	}

	if (password.length < 8) {
		return Response.json({ error: '密碼長度至少需要 8 個字元' }, { status: 400 });
	}

	// Check registration mode
	const registrationMode = await getRegistrationMode();

	if (registrationMode === 'closed') {
		return Response.json({ error: '目前不開放註冊' }, { status: 403 });
	}

	// Check invite code if required
	let validatedInviteCodeId: string | undefined;
	if (registrationMode === 'invite_only') {
		if (!inviteCode) {
			return Response.json({ error: '需要邀請碼才能註冊' }, { status: 400 });
		}
		const validation = await validateInviteCode(inviteCode);
		if (!validation.valid) {
			return Response.json({ error: validation.error }, { status: 400 });
		}
		validatedInviteCodeId = validation.codeId;
	}

	// Check if email already exists
	const existingUser = await db.query.users.findFirst({
		where: eq(users.email, email)
	});

	if (existingUser) {
		return Response.json({ error: '此電子郵件已被註冊' }, { status: 400 });
	}

	// Check if this is the first user (make them admin)
	const userCount = await db.select().from(users).limit(1);
	const isFirstUser = userCount.length === 0;

	// Create user
	const passwordHash = await hashPassword(password);
	const [newUser] = await db
		.insert(users)
		.values({
			email,
			passwordHash,
			name: name || null,
			role: isFirstUser ? 'admin' : 'viewer'
		})
		.returning();

	// Record invite code usage
	if (validatedInviteCodeId) {
		await db.insert(inviteCodeUses).values({
			inviteCodeId: validatedInviteCodeId,
			userId: newUser.id
		});

		await db
			.update(inviteCodes)
			.set({
				usedCount:
					(await db.query.inviteCodes.findFirst({
						where: eq(inviteCodes.id, validatedInviteCodeId)
					}))!.usedCount! + 1
			})
			.where(eq(inviteCodes.id, validatedInviteCodeId));
	}

	// Create session
	const token = generateSessionToken();
	const session = await createSession(token, newUser.id);

	setSessionTokenCookie({ cookies } as any, token, session.expiresAt);

	return Response.json({
		user: {
			id: newUser.id,
			email: newUser.email,
			name: newUser.name,
			role: newUser.role
		}
	});
};
