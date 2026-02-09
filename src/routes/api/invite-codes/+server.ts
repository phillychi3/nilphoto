import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { inviteCodes } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/invite-codes - List invite codes (admin only)
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const codes = await db.query.inviteCodes.findMany({
		orderBy: [desc(inviteCodes.createdAt)],
		with: {
			creator: { columns: { id: true, name: true, email: true } }
		}
	});

	return json({ codes });
};

// POST /api/invite-codes - Create invite code (admin only)
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const { maxUses, expiresInDays } = await request.json();

	const code = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

	const [newCode] = await db
		.insert(inviteCodes)
		.values({
			code,
			createdBy: locals.user.id,
			maxUses: maxUses || 1,
			expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null
		})
		.returning();

	return json({ code: newCode }, { status: 201 });
};

// DELETE /api/invite-codes - Deactivate invite code
export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const { codeId } = await request.json();

	await db.update(inviteCodes).set({ isActive: false }).where(eq(inviteCodes.id, codeId));

	return json({ success: true });
};
