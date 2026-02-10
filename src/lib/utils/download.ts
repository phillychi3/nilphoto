import JSZip from 'jszip';

export interface DownloadablePhoto {
	id: string;
	url: string;
	filename: string;
}

/**
 * 下載照片
 * - 如果超過5張，壓縮成 zip 文件再下載
 */
export async function downloadPhotos(photos: DownloadablePhoto[]): Promise<void> {
	if (photos.length === 0) {
		return;
	}

	if (photos.length <= 5) {
		for (const photo of photos) {
			const a = document.createElement('a');
			a.href = photo.url;
			a.download = photo.filename;
			a.click();
		}
		return;
	}

	try {
		const zip = new JSZip();

		const downloadPromises = photos.map(async (photo) => {
			try {
				const response = await fetch(photo.url);
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
		a.click();

		URL.revokeObjectURL(a.href);
	} catch (error) {
		console.error('Error creating zip file:', error);
		alert('下載失敗，請稍後再試');
	}
}
