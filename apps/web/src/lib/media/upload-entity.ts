/**
 * @file upload-entity.ts
 * @description XHR-based upload helper for entity media.
 *
 * Factored out of PhotoSection.client.tsx so that tests can mock it at the
 * module level without the circular-mock problem that arises when a module
 * tries to mock itself.
 */

/**
 * Upload a file to the protected media upload-entity endpoint via XHR.
 *
 * Uses XHR (not fetch) to expose upload progress events. Always sends
 * `role: 'gallery'` — the 'featured' role used a fixed Cloudinary path
 * (`/featured`) that collides once multiple media rows exist per accommodation.
 *
 * @param params - File, accommodation ID, and optional progress callback
 * @returns Uploaded image metadata `{ url, publicId, width, height }`
 */
export async function uploadEntityImage({
    file,
    accommodationId,
    onProgress
}: {
    readonly file: File;
    readonly accommodationId: string;
    readonly onProgress?: (percent: number) => void;
}): Promise<{ url: string; publicId: string; width: number; height: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'accommodation');
    formData.append('entityId', accommodationId);
    formData.append('role', 'gallery');

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/v1/protected/media/upload-entity');
        xhr.withCredentials = true;

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });

        xhr.addEventListener('load', () => {
            try {
                const response = JSON.parse(xhr.responseText) as {
                    success?: boolean;
                    data?: { url: string; publicId: string; width: number; height: number };
                    error?: { message?: string };
                };
                if (xhr.status >= 200 && xhr.status < 300 && response.data) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.error?.message ?? 'Upload failed'));
                }
            } catch {
                reject(new Error('Invalid response from upload endpoint'));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });

        xhr.send(formData);
    });
}
