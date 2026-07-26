/**
 * @file upload-entity.ts
 * @description XHR-based upload helper for entity media.
 *
 * Factored out of PhotoSection.client.tsx so that tests can mock it at the
 * module level without the circular-mock problem that arises when a module
 * tries to mock itself.
 */

import { getApiUrl } from '@/lib/env';

/**
 * Server-side budget (ms) the client must always allow for, on top of the
 * transfer itself.
 *
 * Mirrors the API's own single bounded Cloudinary timeout (`UPLOAD_TIMEOUT_MS`
 * in `apps/api/src/services/media/upload-helpers.ts`). The client must never
 * time out before the server can, or the user gets a bare abort instead of the
 * server's typed error.
 */
const SERVER_BUDGET_MS = 25_000;

/**
 * Uplink assumed when budgeting transfer time, in bytes per second.
 *
 * 1 Mbps — a deliberately pessimistic floor for Argentine mobile data, which is
 * the connection the owner uploading a phone photo is actually on. Budgeting
 * for a good connection is what makes a slow one fail: HOS-322 raised the cap
 * to 10 MB, and at the previous flat 40s ceiling only ~15s was left for the
 * transfer, which needs ~5 Mbps sustained UPLINK to clear. That is a timeout on
 * any ordinary cell connection.
 */
const ASSUMED_UPLINK_BYTES_PER_SEC = 125_000;

/**
 * Floor for the client timeout (ms), so a small file still gets a sane ceiling.
 */
const MIN_UPLOAD_TIMEOUT_MS = 40_000;

/**
 * Ceiling for the client timeout (ms).
 *
 * The API sits behind Cloudflare, which abandons an origin response at 100s and
 * returns its own HTML error page. Waiting past that point gains nothing and
 * costs the user the clearest error available: the HTML lands in this module's
 * `JSON.parse` branch and degrades into "invalid response" — exactly the
 * BETA-134 symptom the timeout exists to prevent. Stopping first yields a
 * typed, honest timeout instead.
 */
const MAX_UPLOAD_TIMEOUT_MS = 90_000;

/**
 * Compute the client-side XHR timeout for a given payload.
 *
 * BETA-134: without a client ceiling this XHR would wait forever, and if an
 * upstream reverse proxy killed the connection first the client would only
 * learn about it as a generic `JSON.parse` failure. Scaling with the file
 * rather than using one flat value keeps that protection without punishing the
 * large uploads the raised cap now permits.
 *
 * @param fileSizeBytes - Size of the file being uploaded
 * @returns The timeout in milliseconds
 */
export const resolveUploadTimeoutMs = (fileSizeBytes: number): number => {
    // A non-finite size must not poison the arithmetic: `Math.max(n, NaN)` is
    // NaN, and `xhr.timeout = NaN` coerces to 0 — meaning NO timeout. The guard
    // fails safe (toward the floor) rather than silently deleting the very
    // protection this function provides.
    const bytes = Number.isFinite(fileSizeBytes) && fileSizeBytes > 0 ? fileSizeBytes : 0;
    const transferMs = Math.ceil((bytes / ASSUMED_UPLINK_BYTES_PER_SEC) * 1000);
    return Math.min(
        MAX_UPLOAD_TIMEOUT_MS,
        Math.max(MIN_UPLOAD_TIMEOUT_MS, SERVER_BUDGET_MS + transferMs)
    );
};

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
        // HOS-201: use the absolute API base URL, NOT a relative path. In prod
        // web (hospeda.com.ar) and API (api.hospeda.com.ar) are separate origins,
        // so a relative '/api/...' resolves against the web origin (Astro SSR),
        // which has no such route → 404. Mirrors commerce MediaField.tsx.
        // `withCredentials` keeps sending the session cookie cross-origin (CORS
        // already allows it for the other protected calls).
        xhr.open('POST', `${getApiUrl()}/api/v1/protected/media/upload-entity`);
        xhr.withCredentials = true;
        // BETA-134: bound the request so a hanging upstream (Cloudinary slow
        // response, or a reverse proxy that kills the connection) surfaces a
        // clear, typed timeout error instead of leaving the caller waiting
        // forever or falling through to the generic parse-failure branch below.
        xhr.timeout = resolveUploadTimeoutMs(file.size);

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
