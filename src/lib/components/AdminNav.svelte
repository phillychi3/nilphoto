<script lang="ts">
	import { page } from '$app/state';

	let currentPath = $derived(page.url.pathname);

	interface Props {
		onNavigate?: () => void;
		onLogout?: () => void;
	}

	let { onNavigate, onLogout }: Props = $props();

	const links = [
		{ href: '/admin/upload', label: '上傳' },
		{ href: '/admin/photos', label: '所有照片' },
		{ href: '/admin/albums', label: '相簿管理' },
		{ href: '/admin/users', label: '人員管理' },
		{ href: '/admin/backups', label: '備份管理' },
		{ href: '/admin/settings', label: '站點設定' }
	];
</script>

<nav class="flex flex-col gap-1">
	{#each links as link}
		<a
			href={link.href}
			onclick={() => onNavigate?.()}
			class="rounded-md px-3 py-2 text-sm transition-colors {currentPath === link.href ||
			currentPath.startsWith(link.href + '/')
				? 'bg-accent font-medium text-accent-foreground'
				: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
		>
			{link.label}
		</a>
	{/each}

	{#if onLogout}
		<div class="my-2 border-t border-border"></div>
		<button
			onclick={() => {
				onNavigate?.();
				onLogout?.();
			}}
			class="rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
		>
			登出
		</button>
	{/if}
</nav>
