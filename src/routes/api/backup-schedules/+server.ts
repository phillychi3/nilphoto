import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { backupSchedules } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/backup-schedules
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const schedules = await db.query.backupSchedules.findMany({
		orderBy: [desc(backupSchedules.createdAt)],
		with: {
			storageConfig: {
				columns: { id: true, name: true, provider: true }
			}
		}
	});

	return json({ schedules });
};

// POST /api/backup-schedules - Create schedule
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const { storageConfigId, frequency, retentionDays, enabled } = await request.json();

	if (!storageConfigId || !frequency) {
		return json({ error: '請填寫必要欄位' }, { status: 400 });
	}

	const validFreqs = ['hourly', 'daily', 'weekly', 'monthly'];
	if (!validFreqs.includes(frequency)) {
		return json({ error: '無效的備份頻率' }, { status: 400 });
	}

	const nextRun = computeNextRun(frequency);

	const [schedule] = await db
		.insert(backupSchedules)
		.values({
			storageConfigId,
			frequency,
			retentionDays: retentionDays ?? 30,
			enabled: enabled ?? true,
			nextRunAt: nextRun
		})
		.returning();

	return json({ schedule }, { status: 201 });
};

// PUT /api/backup-schedules - Update schedule
export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const { id, enabled, frequency, retentionDays } = await request.json();

	if (!id) {
		return json({ error: '缺少排程 ID' }, { status: 400 });
	}

	const updateData: Record<string, unknown> = {};
	if (enabled !== undefined) updateData.enabled = enabled;
	if (frequency !== undefined) {
		updateData.frequency = frequency;
		updateData.nextRunAt = computeNextRun(frequency);
	}
	if (retentionDays !== undefined) updateData.retentionDays = retentionDays;

	const [updated] = await db
		.update(backupSchedules)
		.set(updateData)
		.where(eq(backupSchedules.id, id))
		.returning();

	return json({ schedule: updated });
};

// DELETE /api/backup-schedules
export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const { id } = await request.json();
	if (!id) {
		return json({ error: '缺少排程 ID' }, { status: 400 });
	}

	await db.delete(backupSchedules).where(eq(backupSchedules.id, id));
	return json({ success: true });
};

function computeNextRun(frequency: string): Date {
	const now = new Date();
	switch (frequency) {
		case 'hourly':
			return new Date(now.getTime() + 60 * 60 * 1000);
		case 'daily':
			return new Date(now.getTime() + 24 * 60 * 60 * 1000);
		case 'weekly':
			return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
		case 'monthly':
			return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
		default:
			return new Date(now.getTime() + 24 * 60 * 60 * 1000);
	}
}
