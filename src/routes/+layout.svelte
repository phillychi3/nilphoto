<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { Button } from '#lib/components/ui/button/index.js';
	import { page } from '$app/state';
	import DownloadProgress from '#lib/components/DownloadProgress.svelte';

	let { children, data } = $props();
	let isAlbumPage = $derived(page.route?.id?.startsWith('/album/') ?? false);
	let isAdminPage = $derived(page.route?.id?.startsWith('/admin') ?? false);
	let user = $state<{ id: string; email: string; name: string | null; role: string } | null>(null);

	async function loadUser() {
		try {
			const res = await fetch('/api/auth/me');
			const data = await res.json();
			user = data.user;
		} catch {
			user = null;
		}
	}

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		user = null;
		window.location.href = '/';
	}

	$effect(() => {
		loadUser();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="dark min-h-screen bg-background text-foreground">
	{#if !isAlbumPage && !isAdminPage}
		<header class="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
			<nav class="mx-auto flex h-14 items-center justify-between px-4">
				<a href="/" class="text-lg font-bold tracking-tight">{data.siteName}</a>
				<div class="flex items-center gap-3">
					{#if data.ownerName}
						<span class="text-sm text-muted-foreground">{data.ownerName}</span>
					{/if}
					{#each data.headerLinks as link (link.url + link.label)}
						<a
							href={link.url}
							class="text-sm text-muted-foreground hover:text-foreground"
							{...link.url.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer' }}
						>
							{link.label}
						</a>
					{/each}
					{#if user}
						{#if user.role === 'admin'}
							<a href="/admin/settings" class="text-sm text-muted-foreground hover:text-foreground">
								管理
							</a>
						{/if}
						<span class="text-sm text-muted-foreground">{user.name || user.email}</span>
						<Button variant="ghost" size="sm" onclick={handleLogout}>登出</Button>
					{:else}
						<a href="/login">
							<Button variant="ghost" size="sm">登入</Button>
						</a>
					{/if}
				</div>
			</nav>
		</header>
	{/if}

	<main>
		{@render children()}
	</main>

	<DownloadProgress />
</div>
