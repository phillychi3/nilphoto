<script lang="ts">
	import AdminNav from '$lib/components/AdminNav.svelte';
	import * as Drawer from '$lib/components/ui/drawer';
	import { Button } from '$lib/components/ui/button';
	import { page } from '$app/state';

	let { children } = $props();
	let drawerOpen = $state(false);
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

<header class="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
	<nav class="mx-auto flex h-14 items-center justify-between px-4">
		<div class="flex items-center gap-3">
			<div class="lg:hidden">
				<Drawer.Root bind:open={drawerOpen}>
					<Drawer.Trigger>
						<Button variant="ghost" size="icon">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<line x1="4" x2="20" y1="12" y2="12" />
								<line x1="4" x2="20" y1="6" y2="6" />
								<line x1="4" x2="20" y1="18" y2="18" />
							</svg>
							<span class="sr-only">開啟選單</span>
						</Button>
					</Drawer.Trigger>
					<Drawer.Content>
						<div class="mx-auto w-full max-w-sm p-4">
							<Drawer.Header>
								<Drawer.Title>管理選單</Drawer.Title>
							</Drawer.Header>
							<div class="py-4">
								<AdminNav
									onNavigate={() => (drawerOpen = false)}
									onLogout={handleLogout}
								/>
							</div>
						</div>
					</Drawer.Content>
				</Drawer.Root>
			</div>
			<a href="/" class="text-lg font-bold tracking-tight">{page.data.siteName}</a>
		</div>
		<div class="flex items-center gap-3">
			{#if user}
				<span class="text-sm text-muted-foreground">{user.name || user.email}</span>
				<Button variant="ghost" size="sm" onclick={handleLogout}>登出</Button>
			{/if}
		</div>
	</nav>
</header>

<div class="mx-auto flex flex-col gap-6 px-4 py-4 lg:flex-row">
	<aside class="hidden w-48 shrink-0 lg:block">
		<AdminNav onLogout={handleLogout} />
	</aside>

	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
