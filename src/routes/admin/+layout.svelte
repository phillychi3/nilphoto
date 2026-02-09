<script lang="ts">
	import AdminNav from '$lib/components/AdminNav.svelte';
	import * as Drawer from '$lib/components/ui/drawer';
	import { Button } from '$lib/components/ui/button';

	let { children } = $props();
	let drawerOpen = $state(false);
</script>

<div class="mx-auto flex flex-col gap-6 px-4 py-4 lg:flex-row">
	<div class="md:hidden">
		<Drawer.Root bind:open={drawerOpen}>
			<Drawer.Trigger>
				<Button variant="outline" size="icon">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
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
						<AdminNav onNavigate={() => (drawerOpen = false)} />
					</div>
				</div>
			</Drawer.Content>
		</Drawer.Root>
	</div>

	<aside class="hidden w-48 shrink-0 md:block">
		<AdminNav />
	</aside>

	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
