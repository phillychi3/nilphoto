import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { backups, photos } from '$lib/server/db/schema';
import { desc, eq, count, and, sql } from 'drizzle-orm';
import { getStorage } from '$lib/server/storage';

// GET /api/backups - List backups with stats
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
	const offset = (page - 1) * limit;
	const statusFilter = url.searchParams.get('status');

	// Stats
	const [totalBackups] = await db.select({ value: count() }).from(backups);
	const [completedBackups] = await db
		.select({ value: count() })
		.from(backups)
		.where(eq(backups.status, 'completed'));
	const [failedBackups] = await db
		.select({ value: count() })
		.from(backups)
		.where(eq(backups.status, 'failed'));
	const [pendingBackups] = await db
		.select({ value: count() })
		.from(backups)
		.where(eq(backups.status, 'pending'));
	const [totalPhotos] = await db.select({ value: count() }).from(photos);

	// List
	const whereClause = statusFilter ? eq(backups.status, statusFilter as 'pending' | 'in_progress' | 'completed' | 'failed') : undefined;

	const backupList = await db.query.backups.findMany({
		where: whereClause,
		orderBy: [desc(backups.createdAt)],
		limit,
		offset,
		with: {
			photo: {
				columns: { id: true, originalFilename: true, thumbnailPath: true, storagePath: true }
			},
			storageConfig: {
				columns: { id: true, name: true, provider: true }
			}
		}
	});

	const [{ value: filteredTotal }] = await db
		.select({ value: count() })
		.from(backups)
		.where(whereClause);

	return json({
		backups: backupList,
		stats: {
			total: totalBackups.value,
			completed: completedBackups.value,
			failed: failedBackups.value,
			pending: pendingBackups.value,
			totalPhotos: totalPhotos.value
		},
		page,
		limit,
		total: filteredTotal,
		hasMore: offset + backupList.length < filteredTotal
	});
};

// POST /api/backups - Trigger backup
// body: { storageConfigId, photoIds?: string[] }
// If photoIds not provided, backs up all photos not yet backed up to this config
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		return json({ error: '沒有權限' }, { status: 403 });
	}

	const { storageConfigId, photoIds } = await request.json();

	if (!storageConfigId) {
		return json({ error: '請選擇備份儲存服務' }, { status: 400 });
	}

	// Validate storage config exists
	const config = await db.query.storageConfigs.findFirst({
		where: (sc, { eq }) => eq(sc.id, storageConfigId)
	});
	if (!config) {
		return json({ error: '儲存設定不存在' }, { status: 404 });
	}

	let targetPhotos: { id: string; storagePath: string; originalFilename: string }[];

	if (photoIds && photoIds.length > 0) {
		// Specific photos
		targetPhotos = await db.query.photos.findMany({
			where: (p, { inArray }) => inArray(p.id, photoIds),
			columns: { id: true, storagePath: true, originalFilename: true }
		});
	} else {
		// All photos not yet backed up to this config
		const alreadyBacked = await db
			.select({ photoId: backups.photoId })
			.from(backups)
			.where(
				and(
					eq(backups.storageConfigId, storageConfigId),
					eq(backups.status, 'completed')
				)
			);
		const backedIds = new Set(alreadyBacked.map((b) => b.photoId));

		const allPhotos = await db.query.photos.findMany({
			columns: { id: true, storagePath: true, originalFilename: true }
		});
		targetPhotos = allPhotos.filter((p) => !backedIds.has(p.id));
	}

	if (targetPhotos.length === 0) {
		return json({ message: '沒有需要備份的照片', created: 0 });
	}

	// Create backup records
	const records = targetPhotos.map((p) => ({
		photoId: p.id,
		storageConfigId,
		status: 'pending' as const
	}));

	await db.insert(backups).values(records);

	// Process backups in background (simplified - in production use a queue)
	processBackups(storageConfigId, targetPhotos).catch(console.error);

	return json({ message: `已排程 ${targetPhotos.length} 張照片備份`, created: targetPhotos.length }, { status: 201 });
};

async function processBackups(
	storageConfigId: string,
	targetPhotos: { id: string; storagePath: string; originalFilename: string }[]
) {
	const sourceStorage = await getStorage(); // Default storage (where photos live)
	const backupStorage = await getStorage(storageConfigId);

	for (const photo of targetPhotos) {
		const backupRecord = await db.query.backups.findFirst({
			where: and(
				eq(backups.photoId, photo.id),
				eq(backups.storageConfigId, storageConfigId),
				eq(backups.status, 'pending')
			)
		});

		if (!backupRecord) continue;

		// Mark as in_progress
		await db
			.update(backups)
			.set({ status: 'in_progress' })
			.where(eq(backups.id, backupRecord.id));

		try {
			const data = await sourceStorage.download(photo.storagePath);
			const backupKey = `backups/${photo.storagePath}`;
			await backupStorage.upload(backupKey, data);

			await db
				.update(backups)
				.set({
					status: 'completed',
					backupPath: backupKey,
					completedAt: new Date()
				})
				.where(eq(backups.id, backupRecord.id));
		} catch (err) {
			await db
				.update(backups)
				.set({
					status: 'failed',
					errorMessage: err instanceof Error ? err.message : String(err)
				})
				.where(eq(backups.id, backupRecord.id));
		}
	}
}
