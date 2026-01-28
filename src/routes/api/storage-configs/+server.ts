import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { storageConfigs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/storage-configs - List all storage configs
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const configs = await db.select().from(storageConfigs);

	// Mask secrets in response
	const masked = configs.map((c) => {
		const config = c.config as Record<string, string>;
		return {
			...c,
			config: {
				...config,
				accessKeyId: config.accessKeyId ? '***' + config.accessKeyId.slice(-4) : undefined,
				secretAccessKey: config.secretAccessKey ? '********' : undefined
			}
		};
	});

	return json({ configs: masked });
};

// POST /api/storage-configs - Create a new storage config
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const { provider, name, isDefault, config } = await request.json();

	if (!provider || !name || !config) {
		return json({ error: '缺少必要欄位' }, { status: 400 });
	}

	if (!['s3', 'r2', 'github'].includes(provider)) {
		return json({ error: '不支援的儲存提供者' }, { status: 400 });
	}

	// Validate config fields based on provider
	if (provider === 's3' || provider === 'r2') {
		if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
			return json({ error: '缺少 S3/R2 必要設定 (bucket, accessKeyId, secretAccessKey)' }, { status: 400 });
		}
		if (provider === 'r2' && !config.endpoint) {
			return json({ error: 'R2 需要設定 endpoint' }, { status: 400 });
		}
	}

	// If setting as default, unset all other defaults
	if (isDefault) {
		await db.update(storageConfigs).set({ isDefault: false });
	}

	const [newConfig] = await db
		.insert(storageConfigs)
		.values({
			provider,
			name,
			isDefault: isDefault ?? false,
			config
		})
		.returning();

	return json({ config: newConfig }, { status: 201 });
};
