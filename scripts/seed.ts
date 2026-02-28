import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { hash } from '@node-rs/argon2';
import * as schema from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

const client = createClient({
	url: DATABASE_URL,
	authToken: process.env.DATABASE_AUTH_TOKEN
});
const db = drizzle(client, { schema });

const hashOptions = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

async function seed() {
	console.log('Seeding database...');

	// Check if test user already exists
	const existingUser = await db.query.users.findFirst({
		where: eq(schema.users.email, 'test')
	});

	if (existingUser) {
		console.log('Test user already exists, skipping...');
	} else {
		// Create test user
		const passwordHash = await hash('test', hashOptions);
		const [newUser] = await db
			.insert(schema.users)
			.values({
				email: 'test',
				passwordHash,
				name: 'Test User',
				role: 'admin'
			})
			.returning({ id: schema.users.id });
		console.log('Created test user: email=test, password=test');

		await db.insert(schema.siteSettings).values({
			key: `must_change_password_${newUser.id}`,
			value: true
		});
		console.log('Marked test user as requiring password change on first login');
	}

	// Create featured system album
	const user =
		existingUser || (await db.query.users.findFirst({ where: eq(schema.users.email, 'test') }));

	const existingFeatured = await db.query.albums.findFirst({
		where: eq(schema.albums.isSystem, true)
	});

	if (!existingFeatured && user) {
		await db.insert(schema.albums).values({
			name: '精選',
			description: '精選照片',
			isPublic: true,
			isSystem: true,
			ownerId: user.id
		});
		console.log('Created featured system album');
	} else {
		console.log('Featured system album already exists, skipping...');
	}

	// Set default registration mode to 'open' if not set
	const registrationMode = await db.query.siteSettings.findFirst({
		where: eq(schema.siteSettings.key, 'registration_mode')
	});

	if (!registrationMode) {
		await db.insert(schema.siteSettings).values({
			key: 'registration_mode',
			value: 'open'
		});
		console.log('Set default registration mode to "open"');
	}

	console.log('Seeding complete!');
	process.exit(0);
}

seed().catch((err) => {
	console.error('Seeding failed:', err);
	process.exit(1);
});
