import { json, type RequestHandler } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { siteSettings } from '$lib/server/db/schema';

export const GET: RequestHandler = async () => {
	const setting = await db.query.siteSettings.findFirst({
		where: eq(siteSettings.key, 'registration_mode')
	});

	return json({
		mode: (setting?.value as string) || 'open'
	});
};

// PUT /api/auth/registration-mode - Update registration mode (admin only)
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const { mode } = await request.json();

	if (!['open', 'invite_only', 'closed'].includes(mode)) {
		return json({ error: '無效的模式' }, { status: 400 });
	}

	const existing = await db.query.siteSettings.findFirst({
		where: eq(siteSettings.key, 'registration_mode')
	});

	if (existing) {
		await db
			.update(siteSettings)
			.set({ value: mode, updatedAt: new Date() })
			.where(eq(siteSettings.key, 'registration_mode'));
	} else {
		await db.insert(siteSettings).values({ key: 'registration_mode', value: mode });
	}

	return json({ mode });
};
