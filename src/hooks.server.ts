import { redirect, type Handle } from '@sveltejs/kit';
import * as auth from '$lib/server/auth';

// Routes that require authentication
const protectedRoutes = ['/admin', '/upload', '/albums', '/photos'];

// Routes that require admin role
const adminRoutes = ['/admin'];

// Routes that should redirect to home if already logged in
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

	// Redirect logged-in users away from auth pages
	if (event.locals.user && authRoutes.some((route) => pathname.startsWith(route))) {
		throw redirect(302, '/');
	}

	// Check protected routes
	if (protectedRoutes.some((route) => pathname.startsWith(route))) {
		if (!event.locals.user) {
			throw redirect(302, `/login?redirect=${encodeURIComponent(pathname)}`);
		}

		// Check admin routes
		if (adminRoutes.some((route) => pathname.startsWith(route))) {
			if (event.locals.user.role !== 'admin') {
				throw redirect(302, '/');
			}
		}
	}

	return resolve(event);
};

export const handle: Handle = handleAuth;
