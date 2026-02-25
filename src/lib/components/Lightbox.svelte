<script lang="ts">
	import PhotoEditor from './PhotoEditor.svelte';
	import * as Drawer from '$lib/components/ui/drawer';

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
		createdAt?: string;
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

	let {
		photos,
		index = $bindable(-1),
		canEdit = false,
		getPhotoUrl
	}: {
		photos: Photo[];
		index: number;
		canEdit?: boolean;
		getPhotoUrl: (
			photo: { storagePath: string; thumbnailPath: string | null; url?: string; thumbnailUrl?: string | null },
			thumbnail?: boolean
		) => string;
	} = $props();

	let editorOpen = $state(false);
	let imageLoaded = $state(false);
	let thumbnailHidden = $state(false);
	let loadProgress = $state(0);
	let showInfoPanel = $state(false);
	let showDrawer = $state(false);
	let isMobile = $state(false);

	let histogramR = $state<number[]>(new Array(256).fill(0));
	let histogramG = $state<number[]>(new Array(256).fill(0));
	let histogramB = $state<number[]>(new Array(256).fill(0));
	let histogramL = $state<number[]>(new Array(256).fill(0));
	let histogramReady = $state(false);

	$effect(() => {
		const mq = window.matchMedia('(max-width: 767px)');
		isMobile = mq.matches;
		const handler = (e: MediaQueryListEvent) => {
			isMobile = e.matches;
		};
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	function toggleInfo() {
		if (isMobile) {
			showDrawer = true;
		} else {
			showInfoPanel = !showInfoPanel;
		}
	}

	let scale = $state(1);
	let translateX = $state(0);
	let translateY = $state(0);
	let dragging = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let lastTranslateX = $state(0);
	let lastTranslateY = $state(0);

	let lastPinchDist = $state(0);

	let show = $derived(index >= 0);
	let photo = $derived(index >= 0 ? photos[index] : null);

	let fullImageUrl = $state('');
	let currentLoadingId = $state('');
	let loadedBytes = $state('');

	$effect(() => {
		if (photo) {
			const url = getPhotoUrl(photo);
			const photoId = photo.id;
			let aborted = false;
			let blobUrl = '';

			imageLoaded = false;
			thumbnailHidden = false;
			loadProgress = 0;
			loadedBytes = '';
			fullImageUrl = '';
			currentLoadingId = photoId;
			histogramReady = false;

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

					computeHistogram(blobUrl, photoId);
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

	function computeHistogram(imgUrl: string, photoId: string) {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {
			if (currentLoadingId !== photoId) return;

			const canvas = document.createElement('canvas');

			const maxDim = 512;
			const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
			canvas.width = Math.round(img.width * ratio);
			canvas.height = Math.round(img.height * ratio);

			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			const data = imageData.data;

			const r = new Array(256).fill(0);
			const g = new Array(256).fill(0);
			const b = new Array(256).fill(0);
			const l = new Array(256).fill(0);

			for (let i = 0; i < data.length; i += 4) {
				r[data[i]]++;
				g[data[i + 1]]++;
				b[data[i + 2]]++;
				const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
				l[lum]++;
			}

			histogramR = r;
			histogramG = g;
			histogramB = b;
			histogramL = l;
			histogramReady = true;
		};
		img.src = imgUrl;
	}

	function getHistogramPath(data: number[], width: number, height: number): string {
		const max = Math.max(...data);
		if (max === 0) return '';
		const points = data.map((v, i) => {
			const x = (i / 255) * width;
			const y = height - (v / max) * height;
			return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
		});
		return points.join('') + `L${width},${height}L0,${height}Z`;
	}

	function resetView() {
		scale = 1;
		translateX = 0;
		translateY = 0;
	}

	function close() {
		editorOpen = false;
		showInfoPanel = false;
		showDrawer = false;
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
			if (showInfoPanel) {
				showInfoPanel = false;
			} else if (scale > 1) {
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
		if (e.key === 'i' || e.key === 'I') toggleInfo();
	}

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

	function toggleFullscreen() {
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			document.documentElement.requestFullscreen();
		}
	}

	function handleDblClick() {
		if (scale > 1) {
			resetView();
		} else {
			scale = 2.5;
		}
	}

	function formatDate(dateStr: string | null | undefined): string {
		if (!dateStr) return '';
		try {
			const d = new Date(dateStr);
			return d.toLocaleString('zh-TW', {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			});
		} catch {
			return String(dateStr);
		}
	}

	function formatCoord(lat: number | null | undefined, lng: number | null | undefined): string {
		if (lat == null || lng == null) return '';
		const latDir = lat >= 0 ? 'N' : 'S';
		const lngDir = lng >= 0 ? 'E' : 'W';
		return `${Math.abs(lat).toFixed(6)}°${latDir}, ${Math.abs(lng).toFixed(6)}°${lngDir}`;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show && photo}
	<div
		class="fixed inset-0 z-50 flex bg-black/90"
		role="dialog"
		aria-label="圖片檢視器"
		onwheel={handleWheel}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
	>
		<div class="relative flex flex-1 items-center justify-center">
			<div class="absolute top-4 right-4 z-10 flex items-center gap-1">
				<button
					class="rounded-full p-2 text-white/70 hover:text-white"
					onclick={zoomOut}
					aria-label="縮小"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /><line
							x1="8"
							x2="14"
							y1="11"
							y2="11"
						/>
					</svg>
				</button>
				<span class="min-w-12 text-center text-xs text-white/50">
					{Math.round(scale * 100)}%
				</span>
				<button
					class="rounded-full p-2 text-white/70 hover:text-white"
					onclick={zoomIn}
					aria-label="放大"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /><line
							x1="11"
							x2="11"
							y1="8"
							y2="14"
						/><line x1="8" x2="14" y1="11" y2="11" />
					</svg>
				</button>

				<div class="mx-1 h-5 w-px bg-white/20"></div>

				<button
					class="rounded-full p-2 {showInfoPanel || showDrawer
						? 'text-white'
						: 'text-white/70 hover:text-white'}"
					onclick={toggleInfo}
					aria-label="資訊"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
					</svg>
				</button>

				<button
					class="rounded-full p-2 text-white/70 hover:text-white"
					onclick={toggleFullscreen}
					aria-label="全螢幕"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path
							d="M3 16v3a2 2 0 0 0 2 2h3"
						/><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
					</svg>
				</button>

				{#if canEdit}
					<button
						class="rounded-full p-2 text-white/70 hover:text-white"
						onclick={() => {
							resetView();
							editorOpen = true;
						}}
						aria-label="編輯"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path
								d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
							/>
						</svg>
					</button>
				{/if}

				<div class="mx-1 h-5 w-px bg-white/20"></div>

				<button
					class="rounded-full p-2 text-white/70 hover:text-white"
					onclick={close}
					aria-label="關閉"
				>
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
						<path d="M18 6 6 18" /><path d="m6 6 12 12" />
					</svg>
				</button>
			</div>

			{#if index > 0}
				<button
					class="absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-full p-2 text-white/70 hover:text-white"
					onclick={prev}
					aria-label="上一張"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="m15 18-6-6 6-6" />
					</svg>
				</button>
			{/if}

			{#if index < photos.length - 1}
				<button
					class="absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full p-2 text-white/70 hover:text-white"
					onclick={next}
					aria-label="下一張"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="m9 18 6-6-6-6" />
					</svg>
				</button>
			{/if}

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex h-full w-full items-center justify-center overflow-hidden"
				style="cursor: {scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in'}"
				onpointerdown={handlePointerDown}
				onpointermove={handlePointerMove}
				onpointerup={handlePointerUp}
				ondblclick={handleDblClick}
			>
				{#if !thumbnailHidden && photo.thumbnailPath}
					<img
						src={getPhotoUrl(photo, true)}
						alt=""
						class="absolute h-[90vh] w-[90vw] object-contain select-none"
						style="transform: scale({scale}) translate({translateX / scale}px, {translateY /
							scale}px)"
						draggable="false"
					/>
				{/if}

				{#if fullImageUrl}
					<img
						src={fullImageUrl}
						alt={photo.title || photo.originalFilename}
						class="absolute h-[90vh] w-[90vw] object-contain transition-opacity duration-500 select-none {imageLoaded
							? 'opacity-100'
							: 'opacity-0'}"
						style="transform: scale({scale}) translate({translateX / scale}px, {translateY /
							scale}px)"
						draggable="false"
						ontransitionend={(e) => {
							if (e.propertyName === 'opacity' && imageLoaded) thumbnailHidden = true;
						}}
					/>
				{/if}
			</div>

			{#if photo.exif && scale <= 1 && !showInfoPanel}
				<div
					class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 backdrop-blur-sm"
				>
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

			<div class="absolute right-4 bottom-4 flex items-center gap-2 text-xs text-white/40">
				{#if !imageLoaded}
					{#if loadProgress > 0}
						<span class="text-white/60">{loadProgress}%</span>
					{:else if loadProgress === -1}
						<span class="text-white/60">{loadedBytes}</span>
					{:else}
						<div
							class="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white/70"
						></div>
					{/if}
				{/if}
				<span>{index + 1} / {photos.length}</span>
			</div>
		</div>

		{#if showInfoPanel}
			<div
				class="hidden w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-black/80 backdrop-blur-sm md:block"
			>
				<div class="p-4">
					<div class="mb-4">
						{#if photo.title}
							<h3 class="text-sm font-medium text-white">{photo.title}</h3>
						{/if}
						<p class="text-xs text-white/50">{photo.originalFilename}</p>
						{#if photo.description}
							<p class="mt-1 text-xs text-white/60">{photo.description}</p>
						{/if}
					</div>

					{#if histogramReady}
						<div class="mb-4">
							<h4 class="mb-2 text-[11px] font-medium tracking-wider text-white/40 uppercase">
								直方圖
							</h4>
							<div class="relative h-24 w-full overflow-hidden rounded bg-white/5">
								<svg class="h-full w-full" viewBox="0 0 256 100" preserveAspectRatio="none">
									<path d={getHistogramPath(histogramR, 256, 100)} fill="rgba(239,68,68,0.3)" />
									<path d={getHistogramPath(histogramG, 256, 100)} fill="rgba(34,197,94,0.3)" />
									<path d={getHistogramPath(histogramB, 256, 100)} fill="rgba(59,130,246,0.3)" />
									<path
										d={getHistogramPath(histogramL, 256, 100)}
										fill="rgba(255,255,255,0.2)"
										stroke="rgba(255,255,255,0.4)"
										stroke-width="0.5"
									/>
								</svg>
							</div>
						</div>
					{/if}

					<div class="mb-4">
						<h4 class="mb-2 text-[11px] font-medium tracking-wider text-white/40 uppercase">
							圖片資訊
						</h4>
						<div class="space-y-1.5 text-xs">
							{#if photo.width && photo.height}
								<div class="flex justify-between">
									<span class="text-white/50">解析度</span>
									<span class="text-white/80">{photo.width} × {photo.height}</span>
								</div>
							{/if}
							{#if photo.aspectRatio}
								<div class="flex justify-between">
									<span class="text-white/50">長寬比</span>
									<span class="text-white/80">{photo.aspectRatio.toFixed(2)}</span>
								</div>
							{/if}
							{#if photo.createdAt}
								<div class="flex justify-between">
									<span class="text-white/50">上傳時間</span>
									<span class="text-white/80">{formatDate(photo.createdAt)}</span>
								</div>
							{/if}
						</div>
					</div>

					{#if photo.exif}
						<div class="mb-4">
							<h4 class="mb-2 text-[11px] font-medium tracking-wider text-white/40 uppercase">
								相機資訊
							</h4>
							<div class="space-y-1.5 text-xs">
								{#if photo.exif.cameraMake || photo.exif.cameraModel}
									<div class="flex justify-between">
										<span class="text-white/50">相機</span>
										<span class="text-white/80"
											>{photo.exif.cameraMake || ''} {photo.exif.cameraModel || ''}</span
										>
									</div>
								{/if}
								{#if photo.exif.lensModel}
									<div class="flex justify-between">
										<span class="text-white/50">鏡頭</span>
										<span class="text-right text-white/80">{photo.exif.lensModel}</span>
									</div>
								{/if}
							</div>
						</div>

						<div class="mb-4">
							<h4 class="mb-2 text-[11px] font-medium tracking-wider text-white/40 uppercase">
								拍攝參數
							</h4>
							<div class="space-y-1.5 text-xs">
								{#if photo.exif.focalLength}
									<div class="flex justify-between">
										<span class="text-white/50">焦距</span>
										<span class="text-white/80">
											{photo.exif.focalLength}mm
											{#if photo.exif.focalLength35mm}
												<span class="text-white/40">({photo.exif.focalLength35mm}mm 等效)</span>
											{/if}
										</span>
									</div>
								{/if}
								{#if photo.exif.aperture}
									<div class="flex justify-between">
										<span class="text-white/50">光圈</span>
										<span class="text-white/80">f/{photo.exif.aperture}</span>
									</div>
								{/if}
								{#if photo.exif.shutterSpeed}
									<div class="flex justify-between">
										<span class="text-white/50">快門</span>
										<span class="text-white/80">{photo.exif.shutterSpeed}</span>
									</div>
								{/if}
								{#if photo.exif.iso}
									<div class="flex justify-between">
										<span class="text-white/50">ISO</span>
										<span class="text-white/80">{photo.exif.iso}</span>
									</div>
								{/if}
								{#if photo.exif.takenAt}
									<div class="flex justify-between">
										<span class="text-white/50">拍攝時間</span>
										<span class="text-white/80">{formatDate(photo.exif.takenAt)}</span>
									</div>
								{/if}
							</div>
						</div>

						<!-- GPS -->
						{#if photo.exif.latitude != null && photo.exif.longitude != null}
							<div class="mb-4">
								<h4 class="mb-2 text-[11px] font-medium tracking-wider text-white/40 uppercase">
									位置資訊
								</h4>
								<div class="space-y-1.5 text-xs">
									<div class="flex justify-between">
										<span class="text-white/50">座標</span>
										<span class="text-white/80"
											>{formatCoord(photo.exif.latitude, photo.exif.longitude)}</span
										>
									</div>
									{#if photo.exif.altitude != null}
										<div class="flex justify-between">
											<span class="text-white/50">海拔</span>
											<span class="text-white/80">{photo.exif.altitude.toFixed(1)}m</span>
										</div>
									{/if}
									<a
										href="https://www.google.com/maps?q={photo.exif.latitude},{photo.exif
											.longitude}"
										target="_blank"
										rel="noopener noreferrer"
										class="mt-1 inline-block text-blue-400 hover:text-blue-300"
									>
										在 Google Maps 中查看 &rarr;
									</a>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		{/if}

		<Drawer.Root bind:open={showDrawer}>
			<Drawer.Content class="max-h-[80vh]">
				<div class="mx-auto w-full max-w-md">
					<Drawer.Header>
						<Drawer.Title>照片資訊</Drawer.Title>
					</Drawer.Header>
					<div class="overflow-y-auto p-4 pb-8">
						<div class="mb-4">
							{#if photo.title}
								<h3 class="text-sm font-medium">{photo.title}</h3>
							{/if}
							<p class="text-xs text-muted-foreground">{photo.originalFilename}</p>
							{#if photo.description}
								<p class="mt-1 text-xs text-muted-foreground">{photo.description}</p>
							{/if}
						</div>

						{#if histogramReady}
							<div class="mb-4">
								<h4
									class="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
								>
									直方圖
								</h4>
								<div class="relative h-24 w-full overflow-hidden rounded bg-muted">
									<svg class="h-full w-full" viewBox="0 0 256 100" preserveAspectRatio="none">
										<path d={getHistogramPath(histogramR, 256, 100)} fill="rgba(239,68,68,0.3)" />
										<path d={getHistogramPath(histogramG, 256, 100)} fill="rgba(34,197,94,0.3)" />
										<path d={getHistogramPath(histogramB, 256, 100)} fill="rgba(59,130,246,0.3)" />
										<path
											d={getHistogramPath(histogramL, 256, 100)}
											fill="rgba(128,128,128,0.2)"
											stroke="rgba(128,128,128,0.4)"
											stroke-width="0.5"
										/>
									</svg>
								</div>
							</div>
						{/if}

						<div class="mb-4">
							<h4
								class="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
							>
								圖片資訊
							</h4>
							<div class="space-y-1.5 text-xs">
								{#if photo.width && photo.height}
									<div class="flex justify-between">
										<span class="text-muted-foreground">解析度</span>
										<span>{photo.width} × {photo.height}</span>
									</div>
								{/if}
								{#if photo.aspectRatio}
									<div class="flex justify-between">
										<span class="text-muted-foreground">長寬比</span>
										<span>{photo.aspectRatio.toFixed(2)}</span>
									</div>
								{/if}
								{#if photo.createdAt}
									<div class="flex justify-between">
										<span class="text-muted-foreground">上傳時間</span>
										<span>{formatDate(photo.createdAt)}</span>
									</div>
								{/if}
							</div>
						</div>

						{#if photo.exif}
							<div class="mb-4">
								<h4
									class="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
								>
									相機資訊
								</h4>
								<div class="space-y-1.5 text-xs">
									{#if photo.exif.cameraMake || photo.exif.cameraModel}
										<div class="flex justify-between">
											<span class="text-muted-foreground">相機</span>
											<span class="text-right"
												>{photo.exif.cameraMake || ''} {photo.exif.cameraModel || ''}</span
											>
										</div>
									{/if}
									{#if photo.exif.lensModel}
										<div class="flex justify-between">
											<span class="text-muted-foreground">鏡頭</span>
											<span class="text-right">{photo.exif.lensModel}</span>
										</div>
									{/if}
								</div>
							</div>

							<div class="mb-4">
								<h4
									class="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
								>
									拍攝參數
								</h4>
								<div class="space-y-1.5 text-xs">
									{#if photo.exif.focalLength}
										<div class="flex justify-between">
											<span class="text-muted-foreground">焦距</span>
											<span>
												{photo.exif.focalLength}mm
												{#if photo.exif.focalLength35mm}
													<span class="text-muted-foreground"
														>({photo.exif.focalLength35mm}mm 等效)</span
													>
												{/if}
											</span>
										</div>
									{/if}
									{#if photo.exif.aperture}
										<div class="flex justify-between">
											<span class="text-muted-foreground">光圈</span>
											<span>f/{photo.exif.aperture}</span>
										</div>
									{/if}
									{#if photo.exif.shutterSpeed}
										<div class="flex justify-between">
											<span class="text-muted-foreground">快門</span>
											<span>{photo.exif.shutterSpeed}</span>
										</div>
									{/if}
									{#if photo.exif.iso}
										<div class="flex justify-between">
											<span class="text-muted-foreground">ISO</span>
											<span>{photo.exif.iso}</span>
										</div>
									{/if}
									{#if photo.exif.takenAt}
										<div class="flex justify-between">
											<span class="text-muted-foreground">拍攝時間</span>
											<span>{formatDate(photo.exif.takenAt)}</span>
										</div>
									{/if}
								</div>
							</div>

							{#if photo.exif.latitude != null && photo.exif.longitude != null}
								<div class="mb-4">
									<h4
										class="mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
									>
										位置資訊
									</h4>
									<div class="space-y-1.5 text-xs">
										<div class="flex justify-between">
											<span class="text-muted-foreground">座標</span>
											<span>{formatCoord(photo.exif.latitude, photo.exif.longitude)}</span>
										</div>
										{#if photo.exif.altitude != null}
											<div class="flex justify-between">
												<span class="text-muted-foreground">海拔</span>
												<span>{photo.exif.altitude.toFixed(1)}m</span>
											</div>
										{/if}
										<a
											href="https://www.google.com/maps?q={photo.exif.latitude},{photo.exif
												.longitude}"
											target="_blank"
											rel="noopener noreferrer"
											class="mt-1 inline-block text-primary hover:underline"
										>
											在 Google Maps 中查看 &rarr;
										</a>
									</div>
								</div>
							{/if}
						{/if}
					</div>
				</div>
			</Drawer.Content>
		</Drawer.Root>
	</div>

	{#if editorOpen && photo}
		<PhotoEditor
			imageUrl={fullImageUrl || getPhotoUrl(photo)}
			imageWidth={photo.width || 800}
			imageHeight={photo.height || 600}
			onClose={() => (editorOpen = false)}
		/>
	{/if}
{/if}
