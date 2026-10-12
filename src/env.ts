import { defineEnvVars } from '@sveltejs/kit/env';

// 未設定時回傳空字串；DATABASE_URL 的必填檢查在 src/lib/server/db/index.ts
export const variables = defineEnvVars({
	DATABASE_URL: { schema: (input) => input ?? '' },
	DATABASE_AUTH_TOKEN: { schema: (input) => input ?? '' }
});
