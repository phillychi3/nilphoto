import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { siteSettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/site-settings - Get all settings
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const settings = await db.query.siteSettings.findMany();
	const result: Record<string, unknown> = {};
	for (const s of settings) {
		result[s.key] = s.value;
	}

	return json({ settings: result });
};

// PUT /api/site-settings - Update settings
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const { settings } = await request.json();

	if (!settings || typeof settings !== 'object') {
		return json({ error: '無效的設定資料' }, { status: 400 });
	}

	for (const [key, value] of Object.entries(settings)) {
		const existing = await db.query.siteSettings.findFirst({
			where: eq(siteSettings.key, key)
		});

		if (existing) {
			await db
				.update(siteSettings)
				.set({ value: value as string, updatedAt: new Date() })
				.where(eq(siteSettings.key, key));
		} else {
			await db.insert(siteSettings).values({
				key,
				value: value as string
			});
		}
	}

	return json({ success: true });
};
