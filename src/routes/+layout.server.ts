import { db } from '#lib/server/db/index.js';
import { siteSettings } from '#lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

export async function load() {
	const setting = await db.query.siteSettings.findFirst({
		where: eq(siteSettings.key, 'site_name')
	});
	return {
		siteName: (setting?.value as string) || 'NILPhoto'
	};
}
