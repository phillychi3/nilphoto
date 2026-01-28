<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';

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

	// Lightbox state
	let selectedPhotoIndex = $state(-1);
	let showLightbox = $derived(selectedPhotoIndex >= 0);
	let selectedPhoto = $derived(selectedPhotoIndex >= 0 ? photos[selectedPhotoIndex] : null);

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

	function openPhoto(index: number) {
		selectedPhotoIndex = index;
	}

	function closePhoto() {
		selectedPhotoIndex = -1;
	}

	function prevPhoto() {
		if (selectedPhotoIndex > 0) {
			selectedPhotoIndex--;
		}
	}

	function nextPhoto() {
		if (selectedPhotoIndex < photos.length - 1) {
			selectedPhotoIndex++;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!showLightbox) return;
		if (e.key === 'Escape') closePhoto();
		if (e.key === 'ArrowLeft') prevPhoto();
		if (e.key === 'ArrowRight') nextPhoto();
	}

	function getPhotoUrl(photo: Photo, thumbnail = false): string {
		const path = thumbnail && photo.thumbnailPath ? photo.thumbnailPath : photo.storagePath;
		return `/uploads/${path}`;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

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
		<!-- Album Header -->
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

		<!-- Masonry Grid -->
		{#if photos.length === 0}
			<div class="flex flex-col items-center justify-center py-20">
				<p class="text-muted-foreground">此相簿還沒有圖片</p>
			</div>
		{:else}
			<div class="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
				{#each photos as photo, index}
					<button
						class="mb-4 block w-full cursor-zoom-in overflow-hidden rounded-lg break-inside-avoid"
						onclick={() => openPhoto(index)}
					>
						<div class="group relative">
							<img
								src={getPhotoUrl(photo, true)}
								alt={photo.title || photo.originalFilename}
								class="w-full object-cover transition-transform duration-300 group-hover:scale-105"
								style={photo.aspectRatio
									? `aspect-ratio: ${photo.aspectRatio}`
									: ''}
								loading="lazy"
							/>
							<!-- Hover overlay -->
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

	<!-- Lightbox -->
	{#if showLightbox && selectedPhoto}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
			role="dialog"
			aria-label="圖片檢視器"
		>
			<!-- Close button -->
			<button
				class="absolute right-4 top-4 z-10 rounded-full p-2 text-white/70 hover:text-white"
				onclick={closePhoto}
				aria-label="關閉"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 6 6 18"/><path d="m6 6 12 12"/>
				</svg>
			</button>

			<!-- Previous button -->
			{#if selectedPhotoIndex > 0}
				<button
					class="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white/70 hover:text-white"
					onclick={prevPhoto}
					aria-label="上一張"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="m15 18-6-6 6-6"/>
					</svg>
				</button>
			{/if}

			<!-- Next button -->
			{#if selectedPhotoIndex < photos.length - 1}
				<button
					class="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white/70 hover:text-white"
					onclick={nextPhoto}
					aria-label="下一張"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="m9 18 6-6-6-6"/>
					</svg>
				</button>
			{/if}

			<!-- Image -->
			<img
				src={getPhotoUrl(selectedPhoto)}
				alt={selectedPhoto.title || selectedPhoto.originalFilename}
				class="max-h-[90vh] max-w-[90vw] object-contain"
			/>

			<!-- EXIF Info Panel -->
			{#if selectedPhoto.exif}
				<div class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 backdrop-blur-sm">
					<div class="flex items-center gap-4 text-xs text-white/80">
						{#if selectedPhoto.exif.cameraModel}
							<span>{selectedPhoto.exif.cameraMake || ''} {selectedPhoto.exif.cameraModel}</span>
						{/if}
						{#if selectedPhoto.exif.focalLength}
							<span>{selectedPhoto.exif.focalLength}mm</span>
						{/if}
						{#if selectedPhoto.exif.aperture}
							<span>f/{selectedPhoto.exif.aperture}</span>
						{/if}
						{#if selectedPhoto.exif.shutterSpeed}
							<span>{selectedPhoto.exif.shutterSpeed}</span>
						{/if}
						{#if selectedPhoto.exif.iso}
							<span>ISO {selectedPhoto.exif.iso}</span>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/if}
