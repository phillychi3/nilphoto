import JSZip from 'jszip';

export interface DownloadablePhoto {
	id: string;
	url: string;
	filename: string;
}

export type DownloadPhase = 'idle' | 'fetching' | 'zipping' | 'done' | 'error';

/** 全域下載狀態，供 DownloadProgress 元件與下載按鈕顯示進度 */
export const downloadStatus = $state({
	phase: 'idle' as DownloadPhase,
	total: 0,
	done: 0,
	failed: 0,
	loadedBytes: 0,
	/** 0–100，未知時為 null */
	percent: null as number | null
});

let hideTimer: ReturnType<typeof setTimeout> | undefined;

export function isDownloading(): boolean {
	return downloadStatus.phase === 'fetching' || downloadStatus.phase === 'zipping';
}

export function dismissDownloadStatus(): void {
	if (isDownloading()) return;
	clearTimeout(hideTimer);
	downloadStatus.phase = 'idle';
}

function finish(phase: 'done' | 'error') {
	downloadStatus.phase = phase;
	downloadStatus.percent = phase === 'done' ? 100 : downloadStatus.percent;
	clearTimeout(hideTimer);
	hideTimer = setTimeout(() => (downloadStatus.phase = 'idle'), phase === 'done' ? 3000 : 6000);
}

/**
 * 下載照片（透過 API 代理，支援 S3/R2）
 * - 如果超過5張，壓縮成 zip 文件再下載
 */
export async function downloadPhotos(photos: DownloadablePhoto[]): Promise<void> {
	if (photos.length === 0 || isDownloading()) {
		return;
	}

	clearTimeout(hideTimer);
	Object.assign(downloadStatus, {
		phase: 'fetching',
		total: photos.length,
		done: 0,
		failed: 0,
		loadedBytes: 0,
		percent: photos.length === 1 ? 0 : null
	});

	if (photos.length <= 5) {
		for (const photo of photos) {
			const blob = await fetchPhoto(photo, photos.length === 1);
			if (blob) saveBlob(blob, photo.filename);
		}
		finish(downloadStatus.failed === photos.length ? 'error' : 'done');
		return;
	}

	try {
		const zip = new JSZip();

		await Promise.all(
			photos.map(async (photo) => {
				const blob = await fetchPhoto(photo, false);
				if (blob) zip.file(photo.filename, blob);
			})
		);

		if (downloadStatus.failed === photos.length) {
			finish('error');
			return;
		}

		downloadStatus.phase = 'zipping';
		downloadStatus.percent = 0;
		const zipBlob = await zip.generateAsync({ type: 'blob' }, (meta) => {
			downloadStatus.percent = Math.round(meta.percent);
		});

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
		saveBlob(zipBlob, `photos_${timestamp}.zip`);
		finish('done');
	} catch (error) {
		console.error('Error creating zip file:', error);
		finish('error');
	}
}

/** 下載單張照片並累計進度；trackPercent 時依 Content-Length 回報百分比 */
async function fetchPhoto(photo: DownloadablePhoto, trackPercent: boolean): Promise<Blob | null> {
	try {
		const response = await fetch(`/api/photos/${photo.id}/download`);
		if (!response.ok || !response.body) {
			throw new Error(`HTTP ${response.status}`);
		}

		const totalBytes = Number(response.headers.get('Content-Length')) || 0;
		const reader = response.body.getReader();
		const chunks: Uint8Array<ArrayBuffer>[] = [];
		let received = 0;

		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			received += value.length;
			downloadStatus.loadedBytes += value.length;
			if (trackPercent && totalBytes > 0) {
				downloadStatus.percent = Math.min(100, Math.round((received / totalBytes) * 100));
			}
		}

		downloadStatus.done++;
		return new Blob(chunks, {
			type: response.headers.get('Content-Type') || 'application/octet-stream'
		});
	} catch (error) {
		console.error(`Error downloading ${photo.filename}:`, error);
		downloadStatus.failed++;
		return null;
	}
}

function saveBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	// 延後釋放，避免部分瀏覽器在開始儲存前就失效
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
