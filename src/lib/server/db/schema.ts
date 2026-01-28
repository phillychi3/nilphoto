import { relations } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// ============================================
// 1. Users 表
// ============================================
export const users = sqliteTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	name: text('name'),
	role: text('role', { enum: ['admin', 'viewer'] })
		.default('viewer')
		.notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// ============================================
// 2. Sessions 表 (Lucia Auth)
// ============================================
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

// ============================================
// 3. Albums 表
// ============================================
export const albums = sqliteTable(
	'albums',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text('name').notNull(),
		description: text('description'),
		isPublic: integer('is_public', { mode: 'boolean' }).default(false).notNull(),
		shareToken: text('share_token').unique(),
		coverPhotoId: text('cover_photo_id'),
		ownerId: text('owner_id')
			.notNull()
			.references(() => users.id),
		sortOrder: integer('sort_order').default(0),
		createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
	},
	(table) => [
		index('albums_owner_idx').on(table.ownerId),
		index('albums_public_idx').on(table.isPublic)
	]
);

// ============================================
// 4. Photos 表
// ============================================
export const photos = sqliteTable(
	'photos',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		albumId: text('album_id')
			.notNull()
			.references(() => albums.id, { onDelete: 'cascade' }),
		// 檔案資訊
		filename: text('filename').notNull(),
		originalFilename: text('original_filename').notNull(),
		mimeType: text('mime_type').notNull(),
		size: integer('size').notNull(),
		// 儲存路徑
		storagePath: text('storage_path').notNull(),
		thumbnailPath: text('thumbnail_path'),
		storageProvider: text('storage_provider', { enum: ['s3', 'r2', 'github', 'local'] }).notNull(),
		// 圖片資訊
		width: integer('width'),
		height: integer('height'),
		aspectRatio: real('aspect_ratio'),
		isHdr: integer('is_hdr', { mode: 'boolean' }).default(false),
		// Metadata
		title: text('title'),
		description: text('description'),
		// 媒體類型
		mediaType: text('media_type', { enum: ['photo', 'video'] })
			.default('photo')
			.notNull(),
		videoDuration: integer('video_duration'),
		videoPreviewPath: text('video_preview_path'),
		sortOrder: integer('sort_order').default(0),
		createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
	},
	(table) => [index('photos_album_idx').on(table.albumId)]
);

// ============================================
// 5. Photo EXIF 表
// ============================================
export const photoExif = sqliteTable(
	'photo_exif',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		photoId: text('photo_id')
			.notNull()
			.references(() => photos.id, { onDelete: 'cascade' })
			.unique(),
		// 相機資訊
		cameraMake: text('camera_make'),
		cameraModel: text('camera_model'),
		lensModel: text('lens_model'),
		// 拍攝參數
		aperture: real('aperture'),
		shutterSpeed: text('shutter_speed'),
		iso: integer('iso'),
		focalLength: real('focal_length'),
		focalLength35mm: real('focal_length_35mm'),
		// GPS
		latitude: real('latitude'),
		longitude: real('longitude'),
		altitude: real('altitude'),
		// 時間
		takenAt: integer('taken_at', { mode: 'timestamp' }),

		// 原始 EXIF JSON
		rawExif: text('raw_exif', { mode: 'json' })
	},
	(table) => [
		index('photo_exif_photo_idx').on(table.photoId),
		index('photo_exif_location_idx').on(table.latitude, table.longitude)
	]
);

// ============================================
// 6. Storage Configs 表
// ============================================
export const storageConfigs = sqliteTable('storage_configs', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	provider: text('provider', { enum: ['s3', 'r2', 'github'] }).notNull(),
	name: text('name').notNull(),
	isDefault: integer('is_default', { mode: 'boolean' }).default(false),
	config: text('config', { mode: 'json' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// ============================================
// 7. Backups 表
// ============================================
export const backups = sqliteTable(
	'backups',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		photoId: text('photo_id')
			.notNull()
			.references(() => photos.id, { onDelete: 'cascade' }),
		storageConfigId: text('storage_config_id')
			.notNull()
			.references(() => storageConfigs.id),
		status: text('status', { enum: ['pending', 'in_progress', 'completed', 'failed'] })
			.default('pending')
			.notNull(),
		backupPath: text('backup_path'),
		errorMessage: text('error_message'),
		createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
		completedAt: integer('completed_at', { mode: 'timestamp' })
	},
	(table) => [index('backups_photo_idx').on(table.photoId)]
);

// ============================================
// 8. Backup Schedules 表
// ============================================
export const backupSchedules = sqliteTable('backup_schedules', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	storageConfigId: text('storage_config_id')
		.notNull()
		.references(() => storageConfigs.id),
	enabled: integer('enabled', { mode: 'boolean' }).default(true),
	frequency: text('frequency', { enum: ['hourly', 'daily', 'weekly', 'monthly'] }).notNull(),
	retentionDays: integer('retention_days').default(30),
	lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
	nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// ============================================
// 9. Site Settings 表
// ============================================
export const siteSettings = sqliteTable('site_settings', {
	key: text('key').primaryKey(),
	value: text('value', { mode: 'json' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// ============================================
// 10. Invite Codes 表
// ============================================
export const inviteCodes = sqliteTable('invite_codes', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	code: text('code').notNull().unique(),
	createdBy: text('created_by')
		.notNull()
		.references(() => users.id),
	maxUses: integer('max_uses').default(1),
	usedCount: integer('used_count').default(0),
	expiresAt: integer('expires_at', { mode: 'timestamp' }),
	isActive: integer('is_active', { mode: 'boolean' }).default(true),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// ============================================
// 11. Invite Code Uses 表
// ============================================
export const inviteCodeUses = sqliteTable('invite_code_uses', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	inviteCodeId: text('invite_code_id')
		.notNull()
		.references(() => inviteCodes.id),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	usedAt: integer('used_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

// ============================================
// Relations 定義
// ============================================
export const usersRelations = relations(users, ({ many }) => ({
	albums: many(albums),
	sessions: many(sessions),
	inviteCodes: many(inviteCodes),
	inviteCodeUses: many(inviteCodeUses)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] })
}));

export const albumsRelations = relations(albums, ({ one, many }) => ({
	owner: one(users, { fields: [albums.ownerId], references: [users.id] }),
	photos: many(photos),
	coverPhoto: one(photos, { fields: [albums.coverPhotoId], references: [photos.id] })
}));

export const photosRelations = relations(photos, ({ one, many }) => ({
	album: one(albums, { fields: [photos.albumId], references: [albums.id] }),
	exif: one(photoExif, { fields: [photos.id], references: [photoExif.photoId] }),
	backups: many(backups)
}));

export const photoExifRelations = relations(photoExif, ({ one }) => ({
	photo: one(photos, { fields: [photoExif.photoId], references: [photos.id] })
}));

export const storageConfigsRelations = relations(storageConfigs, ({ many }) => ({
	backups: many(backups),
	schedules: many(backupSchedules)
}));

export const backupsRelations = relations(backups, ({ one }) => ({
	photo: one(photos, { fields: [backups.photoId], references: [photos.id] }),
	storageConfig: one(storageConfigs, {
		fields: [backups.storageConfigId],
		references: [storageConfigs.id]
	})
}));

export const backupSchedulesRelations = relations(backupSchedules, ({ one }) => ({
	storageConfig: one(storageConfigs, {
		fields: [backupSchedules.storageConfigId],
		references: [storageConfigs.id]
	})
}));

export const inviteCodesRelations = relations(inviteCodes, ({ one, many }) => ({
	creator: one(users, { fields: [inviteCodes.createdBy], references: [users.id] }),
	uses: many(inviteCodeUses)
}));

export const inviteCodeUsesRelations = relations(inviteCodeUses, ({ one }) => ({
	inviteCode: one(inviteCodes, {
		fields: [inviteCodeUses.inviteCodeId],
		references: [inviteCodes.id]
	}),
	user: one(users, { fields: [inviteCodeUses.userId], references: [users.id] })
}));

// ============================================
// Type Exports (for Lucia Auth)
// ============================================
export type Session = typeof sessions.$inferSelect;
export type User = typeof users.$inferSelect;
