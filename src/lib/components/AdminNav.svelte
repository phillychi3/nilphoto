<script lang="ts">
	import { page } from '$app/stores';

	let currentPath = $derived($page.url.pathname);

	const links = [
		{ href: '/upload', label: '上傳' },
		{ href: '/photos', label: '所有照片' },
		{ href: '/albums', label: '相簿管理' },
		{ href: '/admin/users', label: '人員管理' },
		{ href: '/admin/backups', label: '備份管理' },
		{ href: '/admin/storage', label: '儲存空間' },
		{ href: '/admin/settings', label: '站點設定' }
	];
</script>

<nav class="flex flex-col gap-1">
	{#each links as link}
		<a
			href={link.href}
			class="rounded-md px-3 py-2 text-sm transition-colors {currentPath === link.href ||
			currentPath.startsWith(link.href + '/')
				? 'bg-accent text-accent-foreground font-medium'
				: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
		>
			{link.label}
		</a>
	{/each}
</nav>
