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
