import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const adapter = process.env.VERCEL ? adapterVercel() : adapterNode({ out: 'build' });

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			// Consult https://svelte.dev/docs/kit/integrations
			// for more information about preprocessors
			preprocess: vitePreprocess(),
			adapter
		})
	],
	ssr: {
		external: ['@libsql/client', '@libsql/linux-x64-musl', '@libsql/linux-x64-gnu']
	}
});
