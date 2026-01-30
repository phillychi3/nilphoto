<script lang="ts">
	import CropOverlay, { type CropRect } from './CropOverlay.svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		imageUrl: string;
		imageWidth: number;
		imageHeight: number;
		onClose: () => void;
	}

	let { imageUrl, imageWidth, imageHeight, onClose }: Props = $props();

	let rotation = $state(0);
	let cropping = $state(false);
	let imgEl: HTMLImageElement | null = $state(null);
	let containerEl: HTMLDivElement | null = $state(null);
	let displayWidth = $state(0);
	let displayHeight = $state(0);

	// Crop rect in display pixels
	let crop = $state<CropRect>({ x: 0, y: 0, width: 0, height: 0 });

	// Aspect ratio presets
	type AspectPreset = 'free' | '1:1' | '4:3' | '16:9' | '3:2';
	let aspectPreset = $state<AspectPreset>('free');

	let aspectRatioValue: number | null = $derived.by(() => {
		switch (aspectPreset) {
			case '1:1': return 1;
			case '4:3': return 4 / 3;
			case '16:9': return 16 / 9;
			case '3:2': return 3 / 2;
			default: return null;
		}
	});

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
				case '1:1': return 1;
				case '4:3': return 4 / 3;
				case '16:9': return 16 / 9;
				case '3:2': return 3 / 2;
				default: return null;
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

		canvas.toBlob((blob) => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `edited_${Date.now()}.jpg`;
			a.click();
			URL.revokeObjectURL(url);
		}, 'image/jpeg', 0.92);
	}

	$effect(() => {
		if (imgEl) {
			updateDisplaySize();
		}
	});
</script>

<svelte:window onresize={updateDisplaySize} />

<div class="fixed inset-0 z-50 flex flex-col bg-black">
	<!-- Toolbar -->
	<div class="flex items-center justify-between border-b border-white/10 px-4 py-2">
		<div class="flex items-center gap-2">
			<Button variant="ghost" size="sm" class="text-white hover:text-white" onclick={onClose}>
				&larr; 返回
			</Button>
		</div>

		<div class="flex items-center gap-2">
			{#if !cropping}
				<!-- Rotation buttons -->
				<Button variant="ghost" size="sm" class="text-white hover:text-white" onclick={rotateLeft} aria-label="逆時針旋轉">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
						<path d="M3 3v5h5"/>
					</svg>
				</Button>
				<Button variant="ghost" size="sm" class="text-white hover:text-white" onclick={rotateRight} aria-label="順時針旋轉">
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
						<path d="M21 3v5h-5"/>
					</svg>
				</Button>

				<div class="mx-2 h-5 w-px bg-white/20"></div>

				<Button variant="ghost" size="sm" class="text-white hover:text-white" onclick={startCrop}>
					裁切
				</Button>
			{:else}
				<!-- Crop aspect presets -->
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
			<Button variant="ghost" size="sm" class="text-white hover:text-white" onclick={downloadEdited}>
				下載
			</Button>
		</div>
	</div>

	<!-- Image area -->
	<div
		class="relative flex flex-1 items-center justify-center overflow-hidden"
		bind:this={containerEl}
	>
		<div class="relative" style="transform: rotate({rotation}deg); transition: transform 0.3s ease">
			<img
				bind:this={imgEl}
				src={imageUrl}
				alt="Editing"
				class="max-h-[85vh] max-w-[90vw] object-contain"
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
</div>
