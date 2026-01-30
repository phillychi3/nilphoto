<script lang="ts">
	export interface CropRect {
		x: number;
		y: number;
		width: number;
		height: number;
	}

	interface Props {
		containerWidth: number;
		containerHeight: number;
		aspectRatio?: number | null;
		crop: CropRect;
		onCropChange: (crop: CropRect) => void;
	}

	let { containerWidth, containerHeight, aspectRatio = null, crop, onCropChange }: Props = $props();

	let canvas: HTMLCanvasElement | null = $state(null);
	let dragging = $state<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
	let dragStart = $state({ x: 0, y: 0 });
	let cropStart = $state<CropRect>({ x: 0, y: 0, width: 0, height: 0 });

	const HANDLE_SIZE = 10;
	const MIN_SIZE = 30;

	$effect(() => {
		draw();
	});

	function draw() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		canvas.width = containerWidth;
		canvas.height = containerHeight;

		// Dark overlay
		ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
		ctx.fillRect(0, 0, containerWidth, containerHeight);

		// Clear crop area
		ctx.clearRect(crop.x, crop.y, crop.width, crop.height);

		// Crop border
		ctx.strokeStyle = 'white';
		ctx.lineWidth = 2;
		ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);

		// Grid lines (rule of thirds)
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
		ctx.lineWidth = 1;
		for (let i = 1; i <= 2; i++) {
			const xLine = crop.x + (crop.width / 3) * i;
			const yLine = crop.y + (crop.height / 3) * i;
			ctx.beginPath();
			ctx.moveTo(xLine, crop.y);
			ctx.lineTo(xLine, crop.y + crop.height);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(crop.x, yLine);
			ctx.lineTo(crop.x + crop.width, yLine);
			ctx.stroke();
		}

		// Corner handles
		ctx.fillStyle = 'white';
		const corners = [
			{ x: crop.x, y: crop.y },
			{ x: crop.x + crop.width, y: crop.y },
			{ x: crop.x, y: crop.y + crop.height },
			{ x: crop.x + crop.width, y: crop.y + crop.height }
		];
		for (const corner of corners) {
			ctx.fillRect(
				corner.x - HANDLE_SIZE / 2,
				corner.y - HANDLE_SIZE / 2,
				HANDLE_SIZE,
				HANDLE_SIZE
			);
		}
	}

	function getHandle(x: number, y: number): 'nw' | 'ne' | 'sw' | 'se' | 'move' | null {
		const corners: { key: 'nw' | 'ne' | 'sw' | 'se'; x: number; y: number }[] = [
			{ key: 'nw', x: crop.x, y: crop.y },
			{ key: 'ne', x: crop.x + crop.width, y: crop.y },
			{ key: 'sw', x: crop.x, y: crop.y + crop.height },
			{ key: 'se', x: crop.x + crop.width, y: crop.y + crop.height }
		];

		for (const c of corners) {
			if (Math.abs(x - c.x) < HANDLE_SIZE && Math.abs(y - c.y) < HANDLE_SIZE) {
				return c.key;
			}
		}

		if (x >= crop.x && x <= crop.x + crop.width && y >= crop.y && y <= crop.y + crop.height) {
			return 'move';
		}

		return null;
	}

	function handlePointerDown(e: PointerEvent) {
		const rect = canvas?.getBoundingClientRect();
		if (!rect) return;

		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const handle = getHandle(x, y);

		if (handle) {
			dragging = handle;
			dragStart = { x: e.clientX, y: e.clientY };
			cropStart = { ...crop };
			(e.target as HTMLElement).setPointerCapture(e.pointerId);
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging) {
			// Update cursor
			const rect = canvas?.getBoundingClientRect();
			if (!rect || !canvas) return;
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const handle = getHandle(x, y);
			if (handle === 'nw' || handle === 'se') canvas.style.cursor = 'nwse-resize';
			else if (handle === 'ne' || handle === 'sw') canvas.style.cursor = 'nesw-resize';
			else if (handle === 'move') canvas.style.cursor = 'move';
			else canvas.style.cursor = 'crosshair';
			return;
		}

		const dx = e.clientX - dragStart.x;
		const dy = e.clientY - dragStart.y;
		let newCrop = { ...cropStart };

		if (dragging === 'move') {
			newCrop.x = clamp(cropStart.x + dx, 0, containerWidth - cropStart.width);
			newCrop.y = clamp(cropStart.y + dy, 0, containerHeight - cropStart.height);
		} else {
			// Resize from corner
			if (dragging === 'se') {
				newCrop.width = Math.max(MIN_SIZE, cropStart.width + dx);
				newCrop.height = aspectRatio
					? newCrop.width / aspectRatio
					: Math.max(MIN_SIZE, cropStart.height + dy);
			} else if (dragging === 'nw') {
				newCrop.width = Math.max(MIN_SIZE, cropStart.width - dx);
				newCrop.height = aspectRatio
					? newCrop.width / aspectRatio
					: Math.max(MIN_SIZE, cropStart.height - dy);
				newCrop.x = cropStart.x + cropStart.width - newCrop.width;
				newCrop.y = cropStart.y + cropStart.height - newCrop.height;
			} else if (dragging === 'ne') {
				newCrop.width = Math.max(MIN_SIZE, cropStart.width + dx);
				newCrop.height = aspectRatio
					? newCrop.width / aspectRatio
					: Math.max(MIN_SIZE, cropStart.height - dy);
				newCrop.y = cropStart.y + cropStart.height - newCrop.height;
			} else if (dragging === 'sw') {
				newCrop.width = Math.max(MIN_SIZE, cropStart.width - dx);
				newCrop.height = aspectRatio
					? newCrop.width / aspectRatio
					: Math.max(MIN_SIZE, cropStart.height + dy);
				newCrop.x = cropStart.x + cropStart.width - newCrop.width;
			}

			// Clamp within bounds
			newCrop.x = Math.max(0, newCrop.x);
			newCrop.y = Math.max(0, newCrop.y);
			newCrop.width = Math.min(newCrop.width, containerWidth - newCrop.x);
			newCrop.height = Math.min(newCrop.height, containerHeight - newCrop.y);
		}

		onCropChange(newCrop);
	}

	function handlePointerUp() {
		dragging = null;
	}

	function clamp(val: number, min: number, max: number): number {
		return Math.min(Math.max(val, min), max);
	}
</script>

<canvas
	bind:this={canvas}
	class="absolute inset-0"
	style="width: {containerWidth}px; height: {containerHeight}px"
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
></canvas>
