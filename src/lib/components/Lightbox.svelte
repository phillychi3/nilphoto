<script lang="ts">
	import PhotoEditor from './PhotoEditor.svelte';

	interface Photo {
		id: string;
		filename?: string;
		title: string | null;
		description?: string | null;
		originalFilename: string;
		width: number | null;
		height: number | null;
		aspectRatio?: number | null;
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

	let {
		photos,
		index = $bindable(-1),
		canEdit = false,
		getPhotoUrl
	}: {
		photos: Photo[];
		index: number;
		canEdit?: boolean;
		getPhotoUrl: (photo: { storagePath: string; thumbnailPath: string | null }, thumbnail?: boolean) => string;
	} = $props();

	let editorOpen = $state(false);
	let imageLoaded = $state(false);
	let loadProgress = $state(0);

	// Zoom & pan state
	let scale = $state(1);
	let translateX = $state(0);
	let translateY = $state(0);
	let dragging = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let lastTranslateX = $state(0);
	let lastTranslateY = $state(0);

	// Pinch state
	let lastPinchDist = $state(0);

	let show = $derived(index >= 0);
	let photo = $derived(index >= 0 ? photos[index] : null);

	// Preload full image with fetch + ReadableStream for progress tracking
	let fullImageUrl = $state('');
	let currentLoadingId = $state('');
	let loadedBytes = $state('');

	$effect(() => {
		if (photo) {
			const url = getPhotoUrl(photo);
			const photoId = photo.id;
			let aborted = false;
			let blobUrl = '';

			// Reset state for new photo
			imageLoaded = false;
			loadProgress = 0;
			loadedBytes = '';
			fullImageUrl = '';
			currentLoadingId = photoId;

			const controller = new AbortController();

			(async () => {
				try {
					const res = await fetch(url, { signal: controller.signal });
					if (!res.ok || !res.body) {
						if (!aborted && currentLoadingId === photoId) {
							fullImageUrl = url;
							imageLoaded = true;
						}
						return;
					}

					const contentLength = res.headers.get('Content-Length');
					const total = contentLength ? parseInt(contentLength, 10) : 0;
					const reader = res.body.getReader();
					const chunks: Uint8Array[] = [];
					let received = 0;

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						if (aborted) return;

						chunks.push(value);
						received += value.length;

						if (currentLoadingId === photoId) {
							if (total > 0) {
								loadProgress = Math.round((received / total) * 100);
							} else {
								// No Content-Length: show loaded size
								loadProgress = -1;
								if (received < 1024 * 1024) {
									loadedBytes = `${Math.round(received / 1024)} KB`;
								} else {
									loadedBytes = `${(received / (1024 * 1024)).toFixed(1)} MB`;
								}
							}
						}
					}

					if (aborted || currentLoadingId !== photoId) return;

					const blob = new Blob(chunks as BlobPart[]);
					blobUrl = URL.createObjectURL(blob);
					fullImageUrl = blobUrl;
					loadProgress = 100;
					imageLoaded = true;
				} catch {
					if (!aborted && currentLoadingId === photoId) {
						fullImageUrl = url;
						imageLoaded = true;
					}
				}
			})();

			return () => {
				aborted = true;
				controller.abort();
				if (blobUrl) {
					URL.revokeObjectURL(blobUrl);
				}
			};
		}
	});

	function resetView() {
		scale = 1;
		translateX = 0;
		translateY = 0;
	}

	function close() {
		editorOpen = false;
		resetView();
		index = -1;
	}

	function prev() {
		if (index > 0) {
			resetView();
			index--;
		}
	}

	function next() {
		if (index < photos.length - 1) {
			resetView();
			index++;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (editorOpen || !show) return;
		if (e.key === 'Escape') {
			if (scale > 1) {
				resetView();
			} else {
				close();
			}
		}
		if (e.key === 'ArrowLeft') prev();
		if (e.key === 'ArrowRight') next();
		if (e.key === '+' || e.key === '=') zoomIn();
		if (e.key === '-') zoomOut();
		if (e.key === '0') resetView();
		if (e.key === 'f' || e.key === 'F') toggleFullscreen();
	}

	// Zoom
	function zoomIn() {
		scale = Math.min(scale * 1.5, 10);
	}

	function zoomOut() {
		scale = Math.max(scale / 1.5, 0.5);
		if (scale <= 1) {
			translateX = 0;
			translateY = 0;
		}
	}

	function handleWheel(e: WheelEvent) {
		if (!show) return;
		e.preventDefault();
		const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
		scale = Math.min(Math.max(scale * factor, 0.5), 10);
		if (scale <= 1) {
			translateX = 0;
			translateY = 0;
		}
	}

	// Pan (drag when zoomed)
	function handlePointerDown(e: PointerEvent) {
		if (scale <= 1) return;
		dragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		lastTranslateX = translateX;
		lastTranslateY = translateY;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging) return;
		translateX = lastTranslateX + (e.clientX - dragStartX);
		translateY = lastTranslateY + (e.clientY - dragStartY);
	}

	function handlePointerUp() {
		dragging = false;
	}

	// Pinch zoom (touch)
	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length === 2) {
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			lastPinchDist = Math.sqrt(dx * dx + dy * dy);
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (e.touches.length === 2) {
			e.preventDefault();
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (lastPinchDist > 0) {
				const factor = dist / lastPinchDist;
				scale = Math.min(Math.max(scale * factor, 0.5), 10);
			}
			lastPinchDist = dist;
		}
	}

	function handleTouchEnd() {
		lastPinchDist = 0;
		if (scale <= 1) {
			translateX = 0;
			translateY = 0;
		}
	}

	// Fullscreen
	function toggleFullscreen() {
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			document.documentElement.requestFullscreen();
		}
	}

	// Double click to zoom
	function handleDblClick() {
		if (scale > 1) {
			resetView();
		} else {
			scale = 2.5;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show && photo}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
		role="dialog"
		aria-label="圖片檢視器"
		onwheel={handleWheel}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
	>
		<!-- Top toolbar -->
		<div class="absolute right-4 top-4 z-10 flex items-center gap-1">
			<!-- Zoom controls -->
			<button
				class="rounded-full p-2 text-white/70 hover:text-white"
				onclick={zoomOut}
				aria-label="縮小"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/>
				</svg>
			</button>
			<span class="min-w-[3rem] text-center text-xs text-white/50">
				{Math.round(scale * 100)}%
			</span>
			<button
				class="rounded-full p-2 text-white/70 hover:text-white"
				onclick={zoomIn}
				aria-label="放大"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>
				</svg>
			</button>

			<div class="mx-1 h-5 w-px bg-white/20"></div>

			<!-- Fullscreen -->
			<button
				class="rounded-full p-2 text-white/70 hover:text-white"
				onclick={toggleFullscreen}
				aria-label="全螢幕"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
				</svg>
			</button>

			<!-- Edit -->
			{#if canEdit}
				<button
					class="rounded-full p-2 text-white/70 hover:text-white"
					onclick={() => { resetView(); editorOpen = true; }}
					aria-label="編輯"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
					</svg>
				</button>
			{/if}

			<div class="mx-1 h-5 w-px bg-white/20"></div>

			<!-- Close -->
			<button
				class="rounded-full p-2 text-white/70 hover:text-white"
				onclick={close}
				aria-label="關閉"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 6 6 18"/><path d="m6 6 12 12"/>
				</svg>
			</button>
		</div>

		<!-- Previous -->
		{#if index > 0}
			<button
				class="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white/70 hover:text-white"
				onclick={prev}
				aria-label="上一張"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="m15 18-6-6 6-6"/>
				</svg>
			</button>
		{/if}

		<!-- Next -->
		{#if index < photos.length - 1}
			<button
				class="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-white/70 hover:text-white"
				onclick={next}
				aria-label="下一張"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="m9 18 6-6-6-6"/>
				</svg>
			</button>
		{/if}

		<!-- Image with zoom & pan -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex h-full w-full items-center justify-center overflow-hidden"
			style="cursor: {scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in'}"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			ondblclick={handleDblClick}
		>
			<!-- Thumbnail as blurred background while loading -->
			{#if !imageLoaded && photo.thumbnailPath}
				<img
					src={getPhotoUrl(photo, true)}
					alt=""
					class="absolute max-h-[90vh] max-w-[90vw] select-none object-contain"
					style="transform: scale({scale}) translate({translateX / scale}px, {translateY / scale}px)"
					draggable="false"
				/>
			{/if}

			<!-- Full resolution image -->
			{#if fullImageUrl}
				<img
					src={fullImageUrl}
					alt={photo.title || photo.originalFilename}
					class="max-h-[90vh] max-w-[90vw] select-none object-contain transition-opacity duration-300 {imageLoaded ? 'opacity-100' : 'opacity-0'}"
					style="transform: scale({scale}) translate({translateX / scale}px, {translateY / scale}px)"
					draggable="false"
				/>
			{/if}
		</div>

		<!-- EXIF Info Panel -->
		{#if photo.exif && scale <= 1}
			<div class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 backdrop-blur-sm">
				<div class="flex items-center gap-4 text-xs text-white/80">
					{#if photo.exif.cameraModel}
						<span>{photo.exif.cameraMake || ''} {photo.exif.cameraModel}</span>
					{/if}
					{#if photo.exif.focalLength}
						<span>{photo.exif.focalLength}mm</span>
					{/if}
					{#if photo.exif.aperture}
						<span>f/{photo.exif.aperture}</span>
					{/if}
					{#if photo.exif.shutterSpeed}
						<span>{photo.exif.shutterSpeed}</span>
					{/if}
					{#if photo.exif.iso}
						<span>ISO {photo.exif.iso}</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Counter + Loading progress (bottom right) -->
		<div class="absolute bottom-4 right-4 flex items-center gap-2 text-xs text-white/40">
			{#if !imageLoaded}
				{#if loadProgress > 0}
					<span class="text-white/60">{loadProgress}%</span>
				{:else if loadProgress === -1}
					<span class="text-white/60">{loadedBytes}</span>
				{:else}
					<div class="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white/70"></div>
				{/if}
			{/if}
			<span>{index + 1} / {photos.length}</span>
		</div>
	</div>

	<!-- Photo Editor -->
	{#if editorOpen && photo}
		<PhotoEditor
			imageUrl={fullImageUrl || getPhotoUrl(photo)}
			imageWidth={photo.width || 800}
			imageHeight={photo.height || 600}
			onClose={() => (editorOpen = false)}
		/>
	{/if}
{/if}
