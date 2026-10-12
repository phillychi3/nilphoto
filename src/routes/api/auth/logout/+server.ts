import type { RequestHandler } from '@sveltejs/kit';
import { invalidateSession, deleteSessionTokenCookie } from '#lib/server/auth.js';

export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (locals.session) {
		await invalidateSession(locals.session.id);
	}

	deleteSessionTokenCookie({ cookies } as any);

	return Response.json({ success: true });
};
