import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { storageConfigs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// PUT /api/storage-configs/:id - Update a storage config
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const existing = await db.query.storageConfigs.findFirst({
		where: eq(storageConfigs.id, params.id!)
	});

	if (!existing) {
		return json({ error: '儲存設定不存在' }, { status: 404 });
	}

	const { name, isDefault, config } = await request.json();

	const updateData: Record<string, unknown> = {};

	if (name !== undefined) updateData.name = name;

	if (config !== undefined) {
		// Merge config: preserve existing secrets if not provided
		const existingConfig = existing.config as Record<string, string>;
		const newConfig = { ...existingConfig };

		for (const [key, value] of Object.entries(config as Record<string, string>)) {
			// Skip masked values
			if (value && !value.startsWith('***') && value !== '********') {
				newConfig[key] = value;
			}
		}
		updateData.config = newConfig;
	}

	if (isDefault !== undefined) {
		if (isDefault) {
			// Unset all other defaults
			await db.update(storageConfigs).set({ isDefault: false });
		}
		updateData.isDefault = isDefault;
	}

	const [updated] = await db
		.update(storageConfigs)
		.set(updateData)
		.where(eq(storageConfigs.id, params.id!))
		.returning();

	return json({ config: updated });
};

// DELETE /api/storage-configs/:id - Delete a storage config
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const existing = await db.query.storageConfigs.findFirst({
		where: eq(storageConfigs.id, params.id!)
	});

	if (!existing) {
		return json({ error: '儲存設定不存在' }, { status: 404 });
	}

	await db.delete(storageConfigs).where(eq(storageConfigs.id, params.id!));

	return json({ success: true });
};
