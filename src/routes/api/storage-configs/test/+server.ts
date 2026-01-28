import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { storageConfigs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { S3Adapter } from '$lib/server/storage';

// POST /api/storage-configs/test - Test a storage config connection
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const { configId, config: rawConfig, provider } = await request.json();

	let testConfig: Record<string, string>;

	if (configId) {
		// Test an existing config
		const existing = await db.query.storageConfigs.findFirst({
			where: eq(storageConfigs.id, configId)
		});
		if (!existing) {
			return json({ error: '儲存設定不存在' }, { status: 404 });
		}
		testConfig = existing.config as Record<string, string>;
	} else if (rawConfig && provider) {
		testConfig = rawConfig;
	} else {
		return json({ error: '缺少設定資訊' }, { status: 400 });
	}

	const effectiveProvider = provider || 's3';

	try {
		if (effectiveProvider === 's3' || effectiveProvider === 'r2') {
			const adapter = new S3Adapter({
				bucket: testConfig.bucket,
				region: testConfig.region,
				endpoint: testConfig.endpoint,
				accessKeyId: testConfig.accessKeyId,
				secretAccessKey: testConfig.secretAccessKey,
				publicUrl: testConfig.publicUrl
			});

			// Try a simple operation to verify connection
			const testKey = `_test_connection_${Date.now()}`;
			await adapter.upload(testKey, Buffer.from('test'), { contentType: 'text/plain' });
			await adapter.delete(testKey);

			return json({ success: true, message: '連線測試成功' });
		}

		return json({ error: '不支援的儲存提供者' }, { status: 400 });
	} catch (error) {
		const message = error instanceof Error ? error.message : '連線測試失敗';
		return json({ success: false, error: message }, { status: 400 });
	}
};
