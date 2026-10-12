import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import * as auth from '#lib/server/auth.js';

const protectedRoutes = ['/admin'];

const adminRoutes = ['/admin'];

const authRoutes = ['/login', '/register'];

const handleAuth: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(auth.sessionCookieName);

	if (!sessionToken) {
		event.locals.user = null;
		event.locals.session = null;
	} else {
		const { session, user } = await auth.validateSessionToken(sessionToken);

		if (session) {
			auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
		} else {
			auth.deleteSessionTokenCookie(event);
		}

		event.locals.user = user;
		event.locals.session = session;
	}

	const { pathname } = event.url;

	if (event.locals.user && authRoutes.some((route) => pathname.startsWith(route))) {
		throw redirect(302, '/');
	}

	if (protectedRoutes.some((route) => pathname.startsWith(route))) {
		if (!event.locals.user) {
			throw redirect(302, `/login?redirect=${encodeURIComponent(pathname)}`);
		}

		if (adminRoutes.some((route) => pathname.startsWith(route))) {
			if (event.locals.user.role !== 'admin') {
				throw redirect(302, '/');
			}
		}
	}

	return resolve(event);
};

export const handle: Handle = handleAuth;
