import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { BatchItem } from 'drizzle-orm/batch';
import { and, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';

const { photos, photoTags, tags } = schema;

const INSERT_CHUNK_SIZE = 500;

export interface PhotoTagChangeResult {
	/** Number of existing photos the change was applied to */
	updated: number;
	/** Number of (photo, tag) links actually inserted */
	added: number;
}

/**
 * Add/remove tags on multiple photos. Tags not listed are left untouched,
 * and adding a tag a photo already has is a no-op.
 * Returns null if none of the photos exist.
 */
export async function applyPhotoTagChanges(
	db: LibSQLDatabase<typeof schema>,
	photoIds: string[],
	add: string[],
	remove: string[]
): Promise<PhotoTagChangeResult | null> {
	const removeIds = [...new Set(remove)];
	const addIds = [...new Set(add)].filter((id) => !removeIds.includes(id));

	const validPhotoIds = (
		await db.query.photos.findMany({
			where: inArray(photos.id, [...new Set(photoIds)]),
			columns: { id: true }
		})
	).map((p) => p.id);

	if (validPhotoIds.length === 0) return null;
	if (addIds.length === 0 && removeIds.length === 0) return { updated: 0, added: 0 };

	// Work out which (photo, tag) pairs are missing so we never insert duplicates
	let rowsToInsert: { photoId: string; tagId: string }[] = [];
	if (addIds.length > 0) {
		const validTagIds = (
			await db.query.tags.findMany({
				where: inArray(tags.id, addIds),
				columns: { id: true }
			})
		).map((t) => t.id);

		if (validTagIds.length > 0) {
			const existing = await db
				.select({ photoId: photoTags.photoId, tagId: photoTags.tagId })
				.from(photoTags)
				.where(and(inArray(photoTags.photoId, validPhotoIds), inArray(photoTags.tagId, validTagIds)));
			const existingKeys = new Set(existing.map((r) => `${r.photoId}:${r.tagId}`));

			rowsToInsert = validPhotoIds.flatMap((photoId) =>
				validTagIds
					.filter((tagId) => !existingKeys.has(`${photoId}:${tagId}`))
					.map((tagId) => ({ photoId, tagId }))
			);
		}
	}

	const statements: BatchItem<'sqlite'>[] = [];
	if (removeIds.length > 0) {
		statements.push(
			db
				.delete(photoTags)
				.where(and(inArray(photoTags.photoId, validPhotoIds), inArray(photoTags.tagId, removeIds)))
		);
	}
	for (let i = 0; i < rowsToInsert.length; i += INSERT_CHUNK_SIZE) {
		statements.push(db.insert(photoTags).values(rowsToInsert.slice(i, i + INSERT_CHUNK_SIZE)));
	}

	if (statements.length > 0) {
		// Single round trip, executed atomically
		await db.batch(statements as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
	}

	return { updated: validPhotoIds.length, added: rowsToInsert.length };
}
