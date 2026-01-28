<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';

	interface Album {
		id: string;
		name: string;
		description: string | null;
		isPublic: boolean;
		coverPhoto: {
			thumbnailPath: string;
		} | null;
		owner: {
			id: string;
			name: string | null;
		};
		createdAt: string;
	}

	let albums = $state<Album[]>([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			const res = await fetch('/api/albums');
			const data = await res.json();
			albums = data.albums;
		} catch (err) {
			console.error('Failed to load albums:', err);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>NILPhoto</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold">NILPhoto</h1>
		<p class="mt-2 text-muted-foreground">Photo Gallery</p>
	</div>

	{#if loading}
		<div class="flex justify-center py-20">
			<div class="text-muted-foreground">載入中...</div>
		</div>
	{:else if albums.length === 0}
		<div class="flex flex-col items-center justify-center py-20">
			<p class="text-muted-foreground">目前沒有公開的相簿</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each albums as album}
				<a href="/album/{album.id}" class="group">
					<Card.Root class="overflow-hidden transition-colors hover:border-foreground/20">
						<div class="aspect-4/3 overflow-hidden bg-muted">
							{#if album.coverPhoto?.thumbnailPath}
								<img
									src="/uploads/{album.coverPhoto.thumbnailPath}"
									alt={album.name}
									class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
								/>
							{:else}
								<div
									class="flex h-full w-full items-center justify-center text-muted-foreground"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="48"
										height="48"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="1.5"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
										<circle cx="9" cy="9" r="2" />
										<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
									</svg>
								</div>
							{/if}
						</div>
						<Card.Header>
							<Card.Title>{album.name}</Card.Title>
							{#if album.description}
								<Card.Description>{album.description}</Card.Description>
							{/if}
						</Card.Header>
					</Card.Root>
				</a>
			{/each}
		</div>
	{/if}
</div>
