<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Button } from '$lib/components/ui/button';

	let { children } = $props();
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
	<header class="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
		<nav class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
			<a href="/" class="text-lg font-bold tracking-tight">NILPhoto</a>
			<div class="flex items-center gap-3">
				{#if user}
					{#if user.role === 'admin'}
						<a href="/upload" class="text-sm text-muted-foreground hover:text-foreground">
							上傳
						</a>
						<a href="/photos" class="text-sm text-muted-foreground hover:text-foreground">
							所有照片
						</a>
						<a href="/albums" class="text-sm text-muted-foreground hover:text-foreground">
							相簿管理
						</a>
						<a href="/admin/users" class="text-sm text-muted-foreground hover:text-foreground">
							人員管理
						</a>
						<a href="/admin/settings" class="text-sm text-muted-foreground hover:text-foreground">
							站點設定
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

	<main>
		{@render children()}
	</main>
</div>
