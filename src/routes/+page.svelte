<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Lightbox from '$lib/components/Lightbox.svelte';

	interface Photo {
		id: string;
		filename: string;
		originalFilename: string;
		title: string | null;
		description: string | null;
		width: number | null;
		height: number | null;
		aspectRatio: number | null;
		storagePath: string;
		thumbnailPath: string | null;
		url?: string;
		thumbnailUrl?: string | null;
		exif: {
			cameraMake: string | null;
			cameraModel: string | null;
			lensModel?: string | null;
			aperture: number | null;
			shutterSpeed: string | null;
			iso: number | null;
			focalLength: number | null;
			focalLength35mm?: number | null;
			latitude?: number | null;
			longitude?: number | null;
			altitude?: number | null;
			takenAt?: string | null;
		} | null;
	}

	let photos = $state<Photo[]>([]);
	let loading = $state(true);
	let lightboxIndex = $state(-1);

	onMount(async () => {
		try {
			const res = await fetch('/api/albums?system=featured');
			const data = await res.json();
			photos = data.photos || [];
		} catch (err) {
			console.error('Failed to load featured photos:', err);
		} finally {
			loading = false;
		}
	});

	function getPhotoUrl(
		photo: { storagePath: string; thumbnailPath: string | null; url?: string; thumbnailUrl?: string | null },
		thumbnail = false
	): string {
		if (thumbnail) {
			return photo.thumbnailUrl || `/uploads/${photo.thumbnailPath || photo.storagePath}`;
		}
		return photo.url || `/uploads/${photo.storagePath}`;
	}
</script>

<svelte:head>
	<title>{page.data.siteName}</title>
</svelte:head>

<div class="mx-auto px-4 py-4">
	{#if loading}
		<div class="flex justify-center py-20">
			<div class="text-muted-foreground">載入中...</div>
		</div>
	{:else if photos.length === 0}
		<div class="flex flex-col items-center justify-center py-20">
			<p class="text-muted-foreground">目前沒有精選照片</p>
		</div>
	{:else}
		<div class="columns-1 gap-2 sm:columns-2 lg:columns-3 xl:columns-4">
			{#each photos as photo, idx}
				<button
					class="mb-4 block w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-lg"
					onclick={() => (lightboxIndex = idx)}
				>
					<div class="group relative">
						<img
							src={getPhotoUrl(photo, true)}
							alt={photo.title || photo.originalFilename}
							class="w-full object-cover transition-transform duration-300 group-hover:scale-105"
							style={photo.aspectRatio ? `aspect-ratio: ${photo.aspectRatio}` : ''}
							loading="lazy"
						/>
						<div
							class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100"
						>
							{#if photo.title}
								<p class="text-sm font-medium text-white">{photo.title}</p>
							{/if}
							{#if photo.exif}
								<p class="text-xs text-white/70">
									{#if photo.exif.cameraModel}
										{photo.exif.cameraMake || ''} {photo.exif.cameraModel}
									{/if}
									{#if photo.exif.aperture}
										&middot; f/{photo.exif.aperture}
									{/if}
									{#if photo.exif.shutterSpeed}
										&middot; {photo.exif.shutterSpeed}
									{/if}
									{#if photo.exif.iso}
										&middot; ISO {photo.exif.iso}
									{/if}
								</p>
							{/if}
						</div>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

<Lightbox {photos} bind:index={lightboxIndex} {getPhotoUrl} />
