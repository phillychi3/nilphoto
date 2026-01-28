import sharp from 'sharp';
import exifr from 'exifr';

export interface ImageMetadata {
	width: number;
	height: number;
	aspectRatio: number;
	format: string;
	isHdr: boolean;
}

export interface ExifData {
	cameraMake?: string;
	cameraModel?: string;
	lensModel?: string;
	aperture?: number;
	shutterSpeed?: string;
	iso?: number;
	focalLength?: number;
	focalLength35mm?: number;
	latitude?: number;
	longitude?: number;
	altitude?: number;
	takenAt?: Date;
	rawExif?: Record<string, unknown>;
}

export interface ThumbnailResult {
	buffer: Buffer;
	width: number;
	height: number;
}

const THUMBNAIL_SIZES = {
	small: 300,
	medium: 600,
	large: 1200
};

/**
 * Get image metadata using sharp
 */
export async function getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
	const metadata = await sharp(buffer).metadata();

	if (!metadata.width || !metadata.height) {
		throw new Error('Unable to read image dimensions');
	}

	// Check for HDR by looking at bit depth and color space
	const depth = typeof metadata.depth === 'number' ? metadata.depth : 8;
	const isHdr =
		depth > 8 ||
		metadata.space === 'rgb16' ||
		metadata.space === 'scrgb';

	return {
		width: metadata.width,
		height: metadata.height,
		aspectRatio: metadata.width / metadata.height,
		format: metadata.format || 'unknown',
		isHdr
	};
}

/**
 * Generate a thumbnail from an image buffer
 */
export async function generateThumbnail(
	buffer: Buffer,
	size: keyof typeof THUMBNAIL_SIZES | number = 'medium'
): Promise<ThumbnailResult> {
	const maxSize = typeof size === 'number' ? size : THUMBNAIL_SIZES[size];

	const result = await sharp(buffer)
		.resize(maxSize, maxSize, {
			fit: 'inside',
			withoutEnlargement: true
		})
		.jpeg({ quality: 80, progressive: true })
		.toBuffer({ resolveWithObject: true });

	return {
		buffer: result.data,
		width: result.info.width,
		height: result.info.height
	};
}

/**
 * Extract EXIF data from an image buffer
 */
export async function extractExifData(buffer: Buffer): Promise<ExifData | null> {
	try {
		const exif = await exifr.parse(buffer, {
			tiff: true,
			exif: true,
			gps: true,
			translateKeys: true,
			translateValues: true,
			reviveValues: true
		} as Parameters<typeof exifr.parse>[1]);

		if (!exif) {
			return null;
		}

		// Format shutter speed as a fraction if less than 1 second
		let shutterSpeed: string | undefined;
		if (exif.ExposureTime) {
			if (exif.ExposureTime < 1) {
				shutterSpeed = `1/${Math.round(1 / exif.ExposureTime)}`;
			} else {
				shutterSpeed = `${exif.ExposureTime}s`;
			}
		}

		return {
			cameraMake: exif.Make,
			cameraModel: exif.Model,
			lensModel: exif.LensModel || exif.LensInfo,
			aperture: exif.FNumber,
			shutterSpeed,
			iso: exif.ISO,
			focalLength: exif.FocalLength,
			focalLength35mm: exif.FocalLengthIn35mmFormat,
			latitude: exif.latitude,
			longitude: exif.longitude,
			altitude: exif.GPSAltitude,
			takenAt: exif.DateTimeOriginal || exif.CreateDate,
			rawExif: exif
		};
	} catch (error) {
		console.error('Failed to extract EXIF data:', error);
		return null;
	}
}

/**
 * Process an uploaded image: get metadata, generate thumbnail, extract EXIF
 */
export async function processImage(buffer: Buffer): Promise<{
	metadata: ImageMetadata;
	thumbnail: ThumbnailResult;
	exif: ExifData | null;
}> {
	const [metadata, thumbnail, exif] = await Promise.all([
		getImageMetadata(buffer),
		generateThumbnail(buffer, 'medium'),
		extractExifData(buffer)
	]);

	return { metadata, thumbnail, exif };
}

/**
 * Validate image file type
 */
export function isValidImageType(mimeType: string): boolean {
	const validTypes = [
		'image/jpeg',
		'image/png',
		'image/gif',
		'image/webp',
		'image/avif',
		'image/heic',
		'image/heif',
		'image/tiff'
	];
	return validTypes.includes(mimeType);
}

/**
 * Get maximum allowed file size in bytes (default 50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
