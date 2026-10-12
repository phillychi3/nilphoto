<script lang="ts">
	import CropOverlay, { type CropRect } from './CropOverlay.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	interface Tag {
		id: string;
		name: string;
	}

	interface EditablePhoto {
		id: string;
		title: string | null;
		description?: string | null;
		originalFilename: string;
		tags?: Tag[];
	}

	interface Props {
		imageUrl: string;
		imageWidth: number;
		imageHeight: number;
		photo: EditablePhoto;
		canEditMetadata?: boolean;
		onClose: () => void;
		onPhotoUpdated?: (photo: EditablePhoto) => void;
	}

	let {
		imageUrl,
		imageWidth,
		imageHeight,
		photo,
		canEditMetadata = true,
		onClose,
		onPhotoUpdated
	}: Props = $props();

	let rotation = $state(0);
	let cropping = $state(false);
	let imgEl: HTMLImageElement | null = $state(null);
	let containerEl: HTMLDivElement | null = $state(null);
	let displayWidth = $state(0);
	let displayHeight = $state(0);

	let titleValue = $state('');
	let descriptionValue = $state('');
	let allTags = $state<Tag[]>([]);
	let selectedTags = $state<Tag[]>([]);
	let tagInput = $state('');
	let tagsLoaded = $state(false);
	let tagsLoadError = $state('');
	let creatingTag = $state(false);
	let savingMetadata = $state(false);
	let metadataError = $state('');
	let metadataSuccess = $state('');
	let currentPhotoId = $state('');

	// Crop rect in display pixels
	let crop = $state<CropRect>({ x: 0, y: 0, width: 0, height: 0 });

	// Aspect ratio presets
	type AspectPreset = 'free' | '1:1' | '4:3' | '16:9' | '3:2';
	let aspectPreset = $state<AspectPreset>('free');

	let aspectRatioValue: number | null = $derived.by(() => {
		switch (aspectPreset) {
			case '1:1':
				return 1;
			case '4:3':
				return 4 / 3;
			case '16:9':
				return 16 / 9;
			case '3:2':
				return 3 / 2;
			default:
				return null;
		}
	});

	let filteredTagSuggestions = $derived.by(() => {
		const keyword = tagInput.trim().toLowerCase();
		return allTags
			.filter((tag) => !selectedTags.some((selectedTag) => selectedTag.id === tag.id))
			.filter((tag) => (keyword ? tag.name.toLowerCase().includes(keyword) : true))
			.slice(0, 8);
	});

	function normalizeTextValue(value: string): string | null {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}

	function normalizeTagName(name: string): string {
		return name.trim().replace(/\s+/g, ' ');
	}

	function findExistingTag(name: string): Tag | undefined {
		const normalized = normalizeTagName(name).toLowerCase();
		return allTags.find((tag) => tag.name.toLowerCase() === normalized);
	}

	function setEditorStateFromPhoto() {
		titleValue = photo.title || '';
		descriptionValue = photo.description || '';
		selectedTags = [...(photo.tags || [])].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
		tagInput = '';
		metadataError = '';
		metadataSuccess = '';
	}

	async function loadTags() {
		tagsLoadError = '';
		try {
			const res = await fetch('/api/tags');
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				tagsLoadError = data.error || '無法載入標籤';
				tagsLoaded = false;
				return;
			}
			const data = await res.json();
			allTags = (data.tags || []).sort((a: Tag, b: Tag) => a.name.localeCompare(b.name, 'zh-Hant'));
			tagsLoaded = true;
		} catch {
			tagsLoadError = '無法載入標籤';
			tagsLoaded = false;
		}
	}

	async function ensureTag(name: string): Promise<Tag | null> {
		const normalized = normalizeTagName(name);
		if (!normalized) return null;

		const existing = findExistingTag(normalized);
		if (existing) return existing;

		creatingTag = true;
		try {
			const res = await fetch('/api/tags', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: normalized })
			});

			if (res.status === 409) {
				await loadTags();
				return findExistingTag(normalized) || null;
			}

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || '建立標籤失敗');
			}

			const data = await res.json();
			const createdTag = data.tag as Tag;
			allTags = [...allTags, createdTag].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
			return createdTag;
		} finally {
			creatingTag = false;
		}
	}

	async function addTagFromInput(name = tagInput) {
		const normalized = normalizeTagName(name);
		if (!normalized) return;

		metadataError = '';
		try {
			const tag = await ensureTag(normalized);
			if (!tag) return;

			if (!selectedTags.some((selectedTag) => selectedTag.id === tag.id)) {
				selectedTags = [...selectedTags, tag].sort((a, b) =>
					a.name.localeCompare(b.name, 'zh-Hant')
				);
			}
			tagInput = '';
		} catch (error) {
			metadataError = error instanceof Error ? error.message : '建立標籤失敗';
		}
	}

	function removeTag(tagId: string) {
		selectedTags = selectedTags.filter((tag) => tag.id !== tagId);
		metadataError = '';
		metadataSuccess = '';
	}

	function handleTagInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			addTagFromInput();
		}
	}

	async function saveMetadata() {
		if (!canEditMetadata) return;

		metadataError = '';
		metadataSuccess = '';
		savingMetadata = true;

		try {
			const photoRes = await fetch(`/api/photos/${photo.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: normalizeTextValue(titleValue),
					description: normalizeTextValue(descriptionValue)
				})
			});

			if (!photoRes.ok) {
				const data = await photoRes.json().catch(() => ({}));
				throw new Error(data.error || '儲存照片資訊失敗');
			}

			if (tagsLoaded) {
				const tagsRes = await fetch(`/api/photos/${photo.id}/tags`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ tagIds: selectedTags.map((tag) => tag.id) })
				});

				if (!tagsRes.ok) {
					const data = await tagsRes.json().catch(() => ({}));
					throw new Error(data.error || '儲存標籤失敗');
				}
			}

			const updatedPhoto: EditablePhoto = {
				...photo,
				title: normalizeTextValue(titleValue),
				description: normalizeTextValue(descriptionValue),
				tags: selectedTags
			};

			onPhotoUpdated?.(updatedPhoto);
			metadataSuccess = '照片資訊已更新';
		} catch (error) {
			metadataError = error instanceof Error ? error.message : '儲存失敗';
		} finally {
			savingMetadata = false;
		}
	}

	function applyAspectRatio(ratio: number | null) {
		if (!ratio || !cropping) return;
		const cx = crop.x + crop.width / 2;
		const cy = crop.y + crop.height / 2;
		let newW = crop.width;
		let newH = newW / ratio;
		if (newH > displayHeight) {
			newH = displayHeight * 0.8;
			newW = newH * ratio;
		}
		if (newW > displayWidth) {
			newW = displayWidth * 0.8;
			newH = newW / ratio;
		}
		const newX = Math.max(0, Math.min(cx - newW / 2, displayWidth - newW));
		const newY = Math.max(0, Math.min(cy - newH / 2, displayHeight - newH));
		crop = { x: newX, y: newY, width: newW, height: newH };
	}

	function setAspectPreset(preset: AspectPreset) {
		aspectPreset = preset;
		const ratio = (() => {
			switch (preset) {
				case '1:1':
					return 1;
				case '4:3':
					return 4 / 3;
				case '16:9':
					return 16 / 9;
				case '3:2':
					return 3 / 2;
				default:
					return null;
			}
		})();
		applyAspectRatio(ratio);
	}

	function rotateLeft() {
		rotation -= 90;
	}

	function rotateRight() {
		rotation += 90;
	}

	function resetEdits() {
		rotation = 0;
		cropping = false;
		aspectPreset = 'free';
	}

	function startCrop() {
		cropping = true;
		// Initialize crop to center 80% area
		const margin = 0.1;
		crop = {
			x: displayWidth * margin,
			y: displayHeight * margin,
			width: displayWidth * (1 - 2 * margin),
			height: displayHeight * (1 - 2 * margin)
		};
	}

	function cancelCrop() {
		cropping = false;
	}

	function handleCropChange(newCrop: CropRect) {
		crop = newCrop;
	}

	function updateDisplaySize() {
		if (!imgEl) return;
		displayWidth = imgEl.clientWidth;
		displayHeight = imgEl.clientHeight;
	}

	async function downloadEdited() {
		if (!imgEl) return;

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d')!;

		// Create a temp image to draw from
		const img = new Image();
		img.crossOrigin = 'anonymous';

		await new Promise<void>((resolve) => {
			img.onload = () => resolve();
			img.src = imageUrl;
		});

		const normalizedRotation = ((rotation % 360) + 360) % 360;
		const rad = (normalizedRotation * Math.PI) / 180;
		const isRotated90 = normalizedRotation === 90 || normalizedRotation === 270;

		let srcW = img.naturalWidth;
		let srcH = img.naturalHeight;

		if (cropping) {
			// Calculate scale from display to original
			const scaleX = img.naturalWidth / displayWidth;
			const scaleY = img.naturalHeight / displayHeight;

			const sx = crop.x * scaleX;
			const sy = crop.y * scaleY;
			const sw = crop.width * scaleX;
			const sh = crop.height * scaleY;

			if (isRotated90) {
				canvas.width = sh;
				canvas.height = sw;
			} else {
				canvas.width = sw;
				canvas.height = sh;
			}

			ctx.save();
			ctx.translate(canvas.width / 2, canvas.height / 2);
			ctx.rotate(rad);

			if (isRotated90) {
				ctx.drawImage(img, sx, sy, sw, sh, -sh / 2, -sw / 2, sh, sw);
			} else {
				ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
			}
			ctx.restore();
		} else {
			if (isRotated90) {
				canvas.width = srcH;
				canvas.height = srcW;
			} else {
				canvas.width = srcW;
				canvas.height = srcH;
			}

			ctx.save();
			ctx.translate(canvas.width / 2, canvas.height / 2);
			ctx.rotate(rad);
			ctx.drawImage(img, -srcW / 2, -srcH / 2);
			ctx.restore();
		}

		canvas.toBlob(
			(blob) => {
				if (!blob) return;
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `edited_${Date.now()}.jpg`;
				a.click();
				URL.revokeObjectURL(url);
			},
			'image/jpeg',
			0.92
		);
	}

	$effect(() => {
		if (imgEl) {
			updateDisplaySize();
		}
	});

	$effect(() => {
		if (!photo?.id || currentPhotoId === photo.id) return;
		currentPhotoId = photo.id;
		setEditorStateFromPhoto();
		loadTags();
	});
</script>

<svelte:window onresize={updateDisplaySize} />

<div class="fixed inset-0 z-50 flex flex-col bg-black">
	<div class="flex items-center justify-between border-b border-white/10 px-4 py-2">
		<div class="flex items-center gap-2">
			<Button variant="ghost" size="sm" class="text-white hover:text-white" onclick={onClose}>
				&larr; 返回
			</Button>
		</div>

		<div class="flex items-center gap-2">
			{#if !cropping}
				<Button
					variant="ghost"
					size="sm"
					class="text-white hover:text-white"
					onclick={rotateLeft}
					aria-label="逆時針旋轉"
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
						<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
						<path d="M3 3v5h5" />
					</svg>
				</Button>
				<Button
					variant="ghost"
					size="sm"
					class="text-white hover:text-white"
					onclick={rotateRight}
					aria-label="順時針旋轉"
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
						<path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
						<path d="M21 3v5h-5" />
					</svg>
				</Button>

				<div class="mx-2 h-5 w-px bg-white/20"></div>

				<Button variant="ghost" size="sm" class="text-white hover:text-white" onclick={startCrop}>
					裁切
				</Button>
			{:else}
				{#each ['free', '1:1', '4:3', '16:9', '3:2'] as preset}
					<Button
						variant={aspectPreset === preset ? 'secondary' : 'ghost'}
						size="sm"
						class="text-white hover:text-white"
						onclick={() => setAspectPreset(preset as AspectPreset)}
					>
						{preset === 'free' ? '自由' : preset}
					</Button>
				{/each}

				<div class="mx-2 h-5 w-px bg-white/20"></div>

				<Button variant="ghost" size="sm" class="text-white hover:text-white" onclick={cancelCrop}>
					取消裁切
				</Button>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<Button variant="ghost" size="sm" class="text-white hover:text-white" onclick={resetEdits}>
				重置
			</Button>
			<Button
				variant="ghost"
				size="sm"
				class="text-white hover:text-white"
				onclick={downloadEdited}
			>
				下載
			</Button>
		</div>
	</div>

	<div class="flex min-h-0 flex-1 flex-col lg:flex-row">
		<div
			class="relative flex flex-1 items-center justify-center overflow-hidden"
			bind:this={containerEl}
		>
			<div
				class="relative"
				style="transform: rotate({rotation}deg); transition: transform 0.3s ease"
			>
				<img
					bind:this={imgEl}
					src={imageUrl}
					alt="Editing"
					class="max-h-[75vh] max-w-[90vw] object-contain lg:max-h-[85vh]"
					onload={updateDisplaySize}
				/>

				{#if cropping && displayWidth > 0 && displayHeight > 0}
					<CropOverlay
						containerWidth={displayWidth}
						containerHeight={displayHeight}
						aspectRatio={aspectRatioValue}
						{crop}
						onCropChange={handleCropChange}
					/>
				{/if}
			</div>
		</div>

		<aside
			class="w-full overflow-y-auto border-t border-white/10 bg-zinc-950/95 p-4 lg:w-[360px] lg:border-t-0 lg:border-l"
		>
			<div class="space-y-5">
				<div>
					<p class="text-xs tracking-[0.2em] text-white/40 uppercase">照片資訊</p>
					<p class="mt-1 text-sm text-white/60">{photo.originalFilename}</p>
				</div>

				<div class="space-y-2">
					<Label for="photo-title" class="text-white/80">標題</Label>
					<Input
						id="photo-title"
						bind:value={titleValue}
						placeholder="輸入標題"
						class="border-white/10 bg-white/5 text-white placeholder:text-white/30"
						disabled={!canEditMetadata}
					/>
				</div>

				<div class="space-y-2">
					<Label for="photo-description" class="text-white/80">描述</Label>
					<textarea
						id="photo-description"
						bind:value={descriptionValue}
						rows="4"
						placeholder="輸入描述"
						class="flex min-h-24 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
						disabled={!canEditMetadata}
					></textarea>
				</div>

				<div class="space-y-3">
					<div class="flex items-center justify-between gap-2">
						<Label for="photo-tags" class="text-white/80">標籤</Label>
						{#if tagsLoaded}
							<span class="text-xs text-white/35">{allTags.length} 個現有 tag</span>
						{/if}
					</div>

					<div class="flex flex-wrap gap-2">
						{#if selectedTags.length === 0}
							<span class="text-sm text-white/35">尚未設定 tag</span>
						{:else}
							{#each selectedTags as tag (tag.id)}
								<span
									class="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white"
								>
									{tag.name}
									<button
										type="button"
										class="text-white/50 transition hover:text-white"
										onclick={() => removeTag(tag.id)}
										aria-label={`移除 ${tag.name}`}
										disabled={!canEditMetadata}
									>
										×
									</button>
								</span>
							{/each}
						{/if}
					</div>

					<div class="flex gap-2">
						<Input
							id="photo-tags"
							bind:value={tagInput}
							list={`photo-tag-suggestions-${photo.id}`}
							placeholder="輸入後按 Enter，可選既有 tag 或建立新 tag"
							class="border-white/10 bg-white/5 text-white placeholder:text-white/30"
							onkeydown={handleTagInputKeydown}
							disabled={!canEditMetadata}
						/>
						<Button
							variant="secondary"
							disabled={!canEditMetadata || !tagInput.trim() || creatingTag}
							onclick={() => addTagFromInput()}
						>
							加入
						</Button>
					</div>
					<datalist id={`photo-tag-suggestions-${photo.id}`}>
						{#each filteredTagSuggestions as tag (tag.id)}
							<option value={tag.name}></option>
						{/each}
					</datalist>

					{#if filteredTagSuggestions.length > 0}
						<div class="flex flex-wrap gap-2">
							{#each filteredTagSuggestions as tag (tag.id)}
								<button
									type="button"
									class="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 transition hover:border-white/25 hover:text-white"
									onclick={() => addTagFromInput(tag.name)}
									disabled={!canEditMetadata}
								>
									{tag.name}
								</button>
							{/each}
						</div>
					{/if}

					{#if tagsLoadError && canEditMetadata}
						<p class="text-sm text-amber-300">{tagsLoadError}</p>
					{/if}
				</div>

				<div class="space-y-2">
					{#if metadataError}
						<p class="text-sm text-red-300">{metadataError}</p>
					{/if}
					{#if metadataSuccess}
						<p class="text-sm text-emerald-300">{metadataSuccess}</p>
					{/if}
					<Button
						class="w-full"
						disabled={!canEditMetadata || savingMetadata || creatingTag}
						onclick={saveMetadata}
					>
						{savingMetadata ? '儲存中...' : '儲存照片資訊'}
					</Button>
				</div>
			</div>
		</aside>
	</div>
</div>
