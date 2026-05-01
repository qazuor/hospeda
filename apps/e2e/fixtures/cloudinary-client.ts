/**
 * Cloudinary client for E2E tests (SPEC-092).
 *
 * Uses the Admin API with HTTP basic auth (api_key:api_secret) to avoid
 * pulling the cloudinary SDK as a dependency in apps/e2e. All calls operate
 * against folders under `hospeda/e2e/{run-id}/` so they cannot affect prod
 * assets even if mis-configured.
 *
 * Environment:
 *   - HOSPEDA_CLOUDINARY_CLOUD_NAME
 *   - HOSPEDA_CLOUDINARY_API_KEY
 *   - HOSPEDA_CLOUDINARY_API_SECRET
 *
 * @see https://cloudinary.com/documentation/admin_api
 */

const DEFAULT_RUN_ID_PREFIX = 'e2e';
const ADMIN_API_BASE = 'https://api.cloudinary.com/v1_1';

interface CloudinaryEnv {
    readonly cloudName: string;
    readonly apiKey: string;
    readonly apiSecret: string;
}

/**
 * Resolves Cloudinary credentials from process.env. Throws when any are
 * missing — tests that depend on Cloudinary must skip when not configured.
 */
export function getCloudinaryEnv(): CloudinaryEnv {
    const cloudName = process.env.HOSPEDA_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.HOSPEDA_CLOUDINARY_API_KEY;
    const apiSecret = process.env.HOSPEDA_CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error(
            'Cloudinary E2E tests require HOSPEDA_CLOUDINARY_CLOUD_NAME, _API_KEY, _API_SECRET in env'
        );
    }
    return { cloudName, apiKey, apiSecret };
}

/**
 * Builds a unique folder root for the current E2E run. The run ID is the
 * GitHub Actions run ID when CI, otherwise a local timestamp.
 *
 * Result format: `hospeda/e2e/{runId}/`
 */
export function buildE2eFolderRoot(): string {
    const runId =
        process.env.GITHUB_RUN_ID ??
        process.env.HOSPEDA_E2E_RUN_ID ??
        `local-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    return `hospeda/${DEFAULT_RUN_ID_PREFIX}/${runId}/`;
}

interface CloudinaryResource {
    readonly public_id: string;
    readonly format?: string;
    readonly bytes?: number;
    readonly created_at?: string;
}

interface ResourcesResponse {
    readonly resources: ReadonlyArray<CloudinaryResource>;
    readonly next_cursor?: string;
}

function authHeader(env: CloudinaryEnv): string {
    return `Basic ${Buffer.from(`${env.apiKey}:${env.apiSecret}`).toString('base64')}`;
}

/**
 * Returns true when the asset exists on Cloudinary, false on 404.
 * Throws on any other error (network, 5xx).
 */
export async function assetExists(publicId: string, env?: CloudinaryEnv): Promise<boolean> {
    const credentials = env ?? getCloudinaryEnv();
    const url = `${ADMIN_API_BASE}/${credentials.cloudName}/resources/image/upload/${encodeURIComponent(publicId)}`;
    const response = await fetch(url, {
        headers: { Authorization: authHeader(credentials) }
    });
    if (response.status === 404) return false;
    if (!response.ok) {
        throw new Error(`Cloudinary assetExists failed: ${response.status} ${response.statusText}`);
    }
    return true;
}

/**
 * Lists all assets under a folder prefix. Paginates internally.
 * Caps at 1000 assets — if your test creates more, split into folders.
 */
export async function getFolderContents(
    folderPrefix: string,
    env?: CloudinaryEnv
): Promise<ReadonlyArray<CloudinaryResource>> {
    const credentials = env ?? getCloudinaryEnv();
    const out: CloudinaryResource[] = [];
    let cursor: string | undefined;
    do {
        const params = new URLSearchParams({
            prefix: folderPrefix,
            type: 'upload',
            max_results: '500'
        });
        if (cursor) params.set('next_cursor', cursor);
        const url = `${ADMIN_API_BASE}/${credentials.cloudName}/resources/image?${params.toString()}`;
        const response = await fetch(url, {
            headers: { Authorization: authHeader(credentials) }
        });
        if (!response.ok) {
            throw new Error(
                `Cloudinary getFolderContents failed: ${response.status} ${response.statusText}`
            );
        }
        const data = (await response.json()) as ResourcesResponse;
        out.push(...data.resources);
        cursor = data.next_cursor;
        if (out.length >= 1000) break;
    } while (cursor);
    return out;
}

/**
 * Deletes all assets under a folder prefix and (best-effort) the folder
 * itself. Idempotent: succeeds even when nothing exists.
 *
 * Used by `afterAll` cleanup hooks for E2E test runs to remove all uploads
 * created under `hospeda/e2e/{run-id}/`.
 */
export async function deleteFolder(folderPrefix: string, env?: CloudinaryEnv): Promise<void> {
    const credentials = env ?? getCloudinaryEnv();
    // 1. Delete all resources under the prefix.
    const deleteResourcesUrl = `${ADMIN_API_BASE}/${credentials.cloudName}/resources/image/upload?prefix=${encodeURIComponent(folderPrefix)}`;
    const resourcesResponse = await fetch(deleteResourcesUrl, {
        method: 'DELETE',
        headers: { Authorization: authHeader(credentials) }
    });
    if (!resourcesResponse.ok && resourcesResponse.status !== 404) {
        throw new Error(
            `Cloudinary deleteFolder (resources) failed: ${resourcesResponse.status} ${resourcesResponse.statusText}`
        );
    }

    // 2. Delete the folder shell. Trailing slash is stripped by Cloudinary.
    const folderPath = folderPrefix.replace(/\/$/, '');
    const deleteFolderUrl = `${ADMIN_API_BASE}/${credentials.cloudName}/folders/${encodeURIComponent(folderPath)}`;
    const folderResponse = await fetch(deleteFolderUrl, {
        method: 'DELETE',
        headers: { Authorization: authHeader(credentials) }
    });
    // Folder API returns 404 when the folder is already gone — treat as success.
    if (!folderResponse.ok && folderResponse.status !== 404) {
        throw new Error(
            `Cloudinary deleteFolder (folder) failed: ${folderResponse.status} ${folderResponse.statusText}`
        );
    }
}
