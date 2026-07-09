/**
 * @file upload-entity.ts
 * @description XHR-based upload helper for entity media.
 *
 * Factored out of PhotoSection.client.tsx so that tests can mock it at the
 * module level without the circular-mock problem that arises when a module
 * tries to mock itself.
 */

/**
 * Client-side upload timeout (ms).
 *
 * BETA-134: the API's own Cloudinary upload has a single bounded timeout
 * (`UPLOAD_TIMEOUT_MS` in `apps/api/src/services/media/upload-helpers.ts`,
 * currently 25s). Without a matching client-side ceiling, this XHR would
 * otherwise wait forever for a response — and if an upstream reverse proxy
 * kills the connection first, the client only learns about it as a generic,
 * unhelpful `JSON.parse` failure. This value MUST exceed the server's own
 * upload timeout plus the time it takes to transfer the file itself, so the
 * client never times out before the server can. Both values are pending
 * calibration during staging smoke.
 */
const UPLOAD_TIMEOUT_MS = 40_000;

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
        // BETA-134: bound the request so a hanging upstream (Cloudinary slow
        // response, or a reverse proxy that kills the connection) surfaces a
        // clear, typed timeout error instead of leaving the caller waiting
        // forever or falling through to the generic parse-failure branch below.
        xhr.timeout = UPLOAD_TIMEOUT_MS;

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
                // BETA-134: an empty body at this point most likely means an
                // upstream reverse proxy replaced our JSON response with its
                // own (e.g. after killing a hung Cloudinary upload) rather
                // than a genuinely malformed payload — surface a clearer,
                // actionable message than a generic parse failure.
                reject(
                    new Error(
                        xhr.responseText
                            ? 'Invalid response from upload endpoint'
                            : 'Upload timed out or the server did not respond. Please try again.'
                    )
                );
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('timeout', () => {
            reject(new Error('Upload timed out. Please try again.'));
        });

        xhr.send(formData);
    });
}
