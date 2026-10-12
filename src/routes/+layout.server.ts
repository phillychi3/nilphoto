import { db } from '#lib/server/db/index.js';
import { siteSettings } from '#lib/server/db/schema.js';
import { inArray } from 'drizzle-orm';

export interface HeaderLink {
	label: string;
	url: string;
}

function isSafeUrl(url: string) {
	return /^(https?:\/\/|mailto:|\/(?![/\\]))/i.test(url);
}

export async function load() {
	const settings = await db.query.siteSettings.findMany({
		where: inArray(siteSettings.key, ['site_name', 'owner_name', 'header_links'])
	});
	const values = Object.fromEntries(settings.map((s) => [s.key, s.value]));

	const headerLinks = Array.isArray(values.header_links)
		? (values.header_links as HeaderLink[]).filter(
				(link) =>
					typeof link?.label === 'string' &&
					typeof link?.url === 'string' &&
					link.label &&
					isSafeUrl(link.url)
			)
		: [];

	return {
		siteName: (values.site_name as string) || 'NILPhoto',
		ownerName: (values.owner_name as string) || '',
		headerLinks
	};
}
