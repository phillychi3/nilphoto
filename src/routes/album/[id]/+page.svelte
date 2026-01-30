<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
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
		exif: {
			cameraMake: string | null;
			cameraModel: string | null;
			aperture: number | null;
			shutterSpeed: string | null;
			iso: number | null;
			focalLength: number | null;
		} | null;
	}

	interface Album {
		id: string;
		name: string;
		description: string | null;
		isPublic: boolean;
		shareToken: string | null;
	}

	let album = $state<Album | null>(null);
	let photos = $state<Photo[]>([]);
	let canEdit = $state(false);
	let loading = $state(true);
	let error = $state('');
	let lightboxIndex = $state(-1);

	onMount(async () => {
		const albumId = $page.params.id;
		const token = $page.url.searchParams.get('token');
		const url = `/api/albums/${albumId}${token ? `?token=${token}` : ''}`;

		try {
			const res = await fetch(url);
			if (!res.ok) {
				const data = await res.json();
				error = data.error || '載入失敗';
				return;
			}
			const data = await res.json();
			album = data.album;
			photos = data.photos;
			canEdit = data.canEdit;
		} catch {
			error = '載入失敗';
		} finally {
			loading = false;
		}
	});

	function getPhotoUrl(photo: { storagePath: string; thumbnailPath: string | null }, thumbnail = false): string {
		const path = thumbnail && photo.thumbnailPath ? photo.thumbnailPath : photo.storagePath;
		return `/uploads/${path}`;
	}
</script>

<svelte:head>
	<title>{album?.name || 'Album'} - NILPhoto</title>
</svelte:head>

{#if loading}
	<div class="flex justify-center py-20">
		<div class="text-muted-foreground">載入中...</div>
	</div>
{:else if error}
	<div class="flex flex-col items-center justify-center py-20">
		<p class="text-destructive">{error}</p>
		<a href="/" class="mt-4 text-sm text-muted-foreground hover:text-foreground">返回首頁</a>
	</div>
{:else if album}
	<div class="mx-auto max-w-7xl px-4 py-8">
		<div class="mb-8">
			<div class="flex items-center gap-2">
				<a href="/" class="text-sm text-muted-foreground hover:text-foreground">&larr; 返回</a>
			</div>
			<h1 class="mt-4 text-3xl font-bold">{album.name}</h1>
			{#if album.description}
				<p class="mt-2 text-muted-foreground">{album.description}</p>
			{/if}
			<p class="mt-1 text-sm text-muted-foreground">{photos.length} 張圖片</p>
		</div>

		{#if photos.length === 0}
			<div class="flex flex-col items-center justify-center py-20">
				<p class="text-muted-foreground">此相簿還沒有圖片</p>
			</div>
		{:else}
			<div class="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
				{#each photos as photo, idx}
					<button
						class="mb-4 block w-full cursor-zoom-in overflow-hidden rounded-lg break-inside-avoid"
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

	<Lightbox {photos} bind:index={lightboxIndex} {canEdit} {getPhotoUrl} />
{/if}
