/**
 * Hook for uploading and deleting media files via the admin API.
 *
 * Uses raw fetch (not fetchApi) for multipart/form-data uploads because
 * fetchApi auto-sets Content-Type: application/json and JSON.stringify()s
 * the body, which breaks FormData boundary negotiation.
 *
 * @module use-media-upload
 */

import { ApiError } from '@/lib/errors';
import { adminLogger } from '@/utils/logger';
import { useMutation } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported entity types for image uploads */
export type UploadEntityType = 'accommodation' | 'destination' | 'event' | 'post';

/** Supported image roles */
export type UploadImageRole = 'featured' | 'gallery';

/**
 * Input for the uploadEntityImage mutation.
 */
export interface UploadEntityImageInput {
    readonly file: File;
    readonly entityType: UploadEntityType;
    readonly entityId: string;
    readonly role: UploadImageRole;
}

/**
 * Response shape from POST /api/v1/admin/media/upload
 */
export interface UploadResponse {
    readonly url: string;
    readonly publicId: string;
    readonly width: number;
    readonly height: number;
}

/**
 * Input for the deleteImage mutation.
 */
export interface DeleteImageInput {
    readonly publicId: string;
}

/**
 * Response shape from DELETE /api/v1/admin/media?publicId=...
 */
export interface DeleteResponse {
    readonly deleted: true;
    readonly publicId: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Reads VITE_API_URL from the Vite env, stripping any trailing slash.
 * Throws if the variable is not set, matching the same guard in fetchApi.
 */
function getBaseUrl(): string {
    const url = (import.meta.env as Record<string, string | undefined>).VITE_API_URL;
    if (!url) {
        throw new Error('[admin] VITE_API_URL is not configured. Set it in your .env.local file.');
    }
    return url.replace(/\/$/, '');
}

/**
 * Performs a raw fetch call and parses the JSON response.
 * Throws ApiError on non-ok responses, matching the behaviour of fetchApi.
 *
 * This helper exists solely for requests that must NOT have Content-Type set
 * by the caller (i.e. multipart/form-data), letting the browser set the
 * boundary automatically.
 */
async function rawFetch<T>(url: string, init: RequestInit): Promise<T> {
    adminLogger.debug(`[use-media-upload] raw fetch → ${init.method ?? 'GET'} ${url}`);

    const res = await fetch(url, { ...init, credentials: 'include' });
    const text = await res.text();

    let parsed: unknown;
    try {
        parsed = text ? JSON.parse(text) : undefined;
    } catch {
        parsed = undefined;
    }

    if (!res.ok) {
        const errorBody = parsed as
            | { message?: string; error?: { message?: string; code?: string } }
            | undefined;

        let message = `Request failed (${res.status})`;
        let errorCode: string | undefined;

        if (errorBody?.error?.message) {
            message = errorBody.error.message;
            errorCode = errorBody.error.code;
        } else if (errorBody?.message) {
            message = errorBody.message;
        }

        throw new ApiError(message, {
            status: res.status,
            code: errorCode as import('@/lib/errors').ApiErrorCode | undefined,
            body: parsed,
            url,
            method: (init.method ?? 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
        });
    }

    return parsed as T;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Return value of the useMediaUpload hook.
 */
export interface UseMediaUploadReturn {
    /** Mutation for uploading an image for an entity. */
    uploadEntityImage: ReturnType<
        typeof useMutation<UploadResponse, Error, UploadEntityImageInput>
    >;
    /** Mutation for deleting an image by publicId. */
    deleteImage: ReturnType<typeof useMutation<DeleteResponse, Error, DeleteImageInput>>;
    /** True while the upload mutation is in flight. */
    isUploading: boolean;
    /** Error from the most recent upload attempt, or null. */
    uploadError: Error | null;
    /** True while the delete mutation is in flight. */
    isDeleting: boolean;
}

/**
 * Custom hook for media upload and deletion in the admin panel.
 *
 * Uses raw fetch for multipart/form-data POSTs so the browser can set the
 * correct Content-Type boundary. Uses fetchApi conventions (credentials,
 * base URL, error handling) for everything else.
 *
 * @returns Object with upload/delete mutations and derived loading/error state.
 *
 * @example
 * ```tsx
 * const { uploadEntityImage, isUploading, uploadError } = useMediaUpload();
 *
 * const handleFileChange = async (file: File) => {
 *   await uploadEntityImage.mutateAsync({
 *     file,
 *     entityType: 'accommodation',
 *     entityId: '123',
 *     role: 'featured',
 *   });
 * };
 * ```
 */
export function useMediaUpload(): UseMediaUploadReturn {
    const uploadEntityImage = useMutation<UploadResponse, Error, UploadEntityImageInput>({
        mutationFn: async ({ file, entityType, entityId, role }: UploadEntityImageInput) => {
            const base = getBaseUrl();
            const url = `${base}/api/v1/admin/media/upload`;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('entityType', entityType);
            formData.append('entityId', entityId);
            formData.append('role', role);

            // Do NOT set Content-Type — the browser sets multipart/form-data
            // with the correct boundary automatically when body is FormData.
            const responseBody = await rawFetch<{ data: UploadResponse }>(url, {
                method: 'POST',
                body: formData
            });

            return responseBody.data;
        }
    });

    const deleteImage = useMutation<DeleteResponse, Error, DeleteImageInput>({
        mutationFn: async ({ publicId }: DeleteImageInput) => {
            const base = getBaseUrl();
            const params = new URLSearchParams({ publicId });
            const url = `${base}/api/v1/admin/media?${params.toString()}`;

            const responseBody = await rawFetch<{ data: DeleteResponse }>(url, {
                method: 'DELETE'
            });

            return responseBody.data;
        }
    });

    return {
        uploadEntityImage,
        deleteImage,
        isUploading: uploadEntityImage.isPending,
        uploadError: uploadEntityImage.error,
        isDeleting: deleteImage.isPending
    };
}

// ---------------------------------------------------------------------------
// Helper: createUploadHandler
// ---------------------------------------------------------------------------

/**
 * Parameters for createUploadHandler.
 */
export interface CreateUploadHandlerParams {
    readonly entityType: UploadEntityType;
    readonly entityId: string;
    readonly role: UploadImageRole;
    readonly onUpload: (input: UploadEntityImageInput) => Promise<UploadResponse>;
}

/**
 * Creates an onUpload handler suitable for passing directly to GalleryField
 * or any other component that expects `(file: File) => Promise<string>`.
 *
 * Bridges the gap between GalleryField's simple `(file) => url` contract and
 * the richer UploadEntityImageInput that the API requires.
 *
 * @param params - Entity context and the upload function to delegate to.
 * @returns A function matching the `(file: File) => Promise<string>` signature.
 *
 * @example
 * ```tsx
 * const { uploadEntityImage } = useMediaUpload();
 *
 * const onUpload = createUploadHandler({
 *   entityType: 'accommodation',
 *   entityId: accommodationId,
 *   role: 'gallery',
 *   onUpload: (input) => uploadEntityImage.mutateAsync(input),
 * });
 *
 * return <GalleryField onUpload={onUpload} />;
 * ```
 */
export function createUploadHandler(
    params: CreateUploadHandlerParams
): (file: File) => Promise<string> {
    return async (file: File): Promise<string> => {
        const result = await params.onUpload({
            file,
            entityType: params.entityType,
            entityId: params.entityId,
            role: params.role
        });
        return result.url;
    };
}
