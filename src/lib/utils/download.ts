import JSZip from 'jszip';

export interface DownloadablePhoto {
	id: string;
	url: string;
	filename: string;
}

/**
 * 下載照片（透過 API 代理，支援 S3/R2）
 * - 如果超過5張，壓縮成 zip 文件再下載
 */
export async function downloadPhotos(photos: DownloadablePhoto[]): Promise<void> {
	if (photos.length === 0) {
		return;
	}

	if (photos.length === 1) {
		await downloadSingle(photos[0]);
		return;
	}

	if (photos.length <= 5) {
		for (const photo of photos) {
			await downloadSingle(photo);
		}
		return;
	}

	try {
		const zip = new JSZip();

		const downloadPromises = photos.map(async (photo) => {
			try {
				const response = await fetch(`/api/photos/${photo.id}/download`);
				if (!response.ok) {
					console.error(`Failed to fetch ${photo.filename}`);
					return;
				}
				const blob = await response.blob();
				zip.file(photo.filename, blob);
			} catch (error) {
				console.error(`Error downloading ${photo.filename}:`, error);
			}
		});

		await Promise.all(downloadPromises);

		const zipBlob = await zip.generateAsync({ type: 'blob' });

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
		const filename = `photos_${timestamp}.zip`;

		const a = document.createElement('a');
		a.href = URL.createObjectURL(zipBlob);
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(a.href);
	} catch (error) {
		console.error('Error creating zip file:', error);
		alert('下載失敗，請稍後再試');
	}
}

async function downloadSingle(photo: DownloadablePhoto): Promise<void> {
	try {
		const response = await fetch(`/api/photos/${photo.id}/download`);
		if (!response.ok) {
			console.error(`Failed to download ${photo.filename}`);
			return;
		}
		const blob = await response.blob();
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = photo.filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	} catch (error) {
		console.error(`Error downloading ${photo.filename}:`, error);
	}
}
