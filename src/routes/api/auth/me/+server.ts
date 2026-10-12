import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return Response.json({ user: null });
	}

	return Response.json({
		user: {
			id: locals.user.id,
			email: locals.user.email,
			name: locals.user.name,
			role: locals.user.role
		}
	});
};
