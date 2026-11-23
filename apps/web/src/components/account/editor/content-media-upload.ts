/**
 * @file content-media-upload.ts
 * @description Upload and persistence helpers of `ContentMediaSection` (the
 * post/event photo section), split out for HOS-2505 so the island stays under
 * the 500-line limit. No React here.
 *
 * - `uploadEntityImage` sends one file to the protected entity-upload endpoint,
 *   bounded by a client-side timeout (BETA-134).
 * - `uploadAndAddContentMedia` chains the upload with `addMedia`, so the photo
 *   is persisted the moment it lands (HOS-390: before, an upload reached
 *   Cloudinary and the URL had nowhere to go).
 * - `describeUploadError` / `validateContentMediaFile` turn failures into
 *   localized sentences.
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import type { Image } from '@repo/schemas';
import {
    type ContentMediaEntity,
    type ContentMediaRow,
    contentMediaApi
} from '@/lib/api/endpoints-protected';
import { visibleApiMessage } from '@/lib/api-errors';
import { getApiUrl } from '@/lib/env';
import type { MediaAttribution } from '@/lib/media';
import { resolveUploadTimeoutMs } from '@/lib/media/upload-entity';
import { buildUploadEntityError, describeUploadEntityError } from '@/lib/media/upload-entity-error';

/** Translator function shape (matches the editor's `createTranslations().t`). */
export type ContentMediaTranslate = (
    key: string,
    fallback?: string,
    params?: Record<string, string | number>
) => string;

/** MIME types the section accepts. */
export const CONTENT_MEDIA_ALLOWED_TYPES: readonly string[] = [
    'image/jpeg',
    'image/png',
    'image/webp'
];

const MAX_SIZE_BYTES = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB);

/**
 * Display item of the section's local state: the DB row's essentials plus the
 * `id` needed to address it in remove / set-featured calls.
 */
export interface ContentMediaItem {
    readonly id: string;
    readonly url: string;
    readonly publicId?: string;
    readonly caption: string | undefined;
    /**
     * Longer photo description (HOS-1036, with `attribution`): both columns
     * existed on `post_media`/`event_media` since HOS-390 and were never read.
     */
    readonly description: string | undefined;
    readonly alt: string | undefined;
    /** Photo credit, when the author declared one. */
    readonly attribution: MediaAttribution | undefined;
    readonly isFeatured: boolean;
}

/**
 * Thrown when the upload exceeds its client-side budget. A distinct type
 * because the browser's abort error carries vendor-specific English text.
 */
export class UploadTimeoutError extends Error {
    constructor() {
        super('upload-timeout');
        this.name = 'UploadTimeoutError';
    }
}

/**
 * Maps a `ContentMediaRow` (from the API) to the local display shape.
 *
 * @param row - The API row.
 * @returns The display item.
 */
export function rowToItem(row: ContentMediaRow): ContentMediaItem {
    return {
        id: row.id,
        url: row.url,
        publicId: row.publicId ?? undefined,
        caption: row.caption ?? undefined,
        description: row.description ?? undefined,
        alt: row.alt ?? undefined,
        attribution: row.attribution ?? undefined,
        isFeatured: row.isFeatured
    };
}

/**
 * Uploads a single image to the protected entity-upload endpoint (`post` and
 * `event` are native `entityType`s there).
 *
 * `AbortController` + `setTimeout` rather than `AbortSignal.timeout`: the
 * latter needs Safari 16, and on an older iOS the property access throws
 * before `fetch` runs.
 *
 * @param input - The file, the entity, its id and the photo role.
 * @returns The uploaded `Image` (Cloudinary url + metadata).
 */
export async function uploadEntityImage({
    file,
    entity,
    entityId,
    role
}: {
    readonly file: File;
    readonly entity: ContentMediaEntity;
    readonly entityId: string;
    readonly role: 'featured' | 'gallery';
}): Promise<Image> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entity);
    formData.append('entityId', entityId);
    formData.append('role', role);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), resolveUploadTimeoutMs(file.size));

    let response: Response;
    try {
        response = await fetch(`${getApiUrl()}/api/v1/protected/media/upload-entity`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            signal: controller.signal
        });
    } catch (error) {
        // An abort is a vendor-specific English DOMException; re-throw a marker.
        if (controller.signal.aborted) {
            throw new UploadTimeoutError();
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }

    const json = (await response.json().catch(() => null)) as {
        readonly success?: boolean;
        readonly data?: Image;
        readonly error?: {
            readonly code?: string;
            readonly reason?: string;
            readonly message?: string;
            readonly details?: unknown;
        };
    } | null;

    if (!response.ok || !json?.data) {
        throw buildUploadEntityError({ body: json, status: response.status });
    }
    return json.data;
}

/** Outcome of {@link uploadAndAddContentMedia}. */
export type UploadAndAddOutcome =
    | { readonly ok: true; readonly row: ContentMediaRow }
    | { readonly ok: false; readonly message: string };

/**
 * Uploads a file and creates its media row right away. A thrown upload error
 * propagates (the caller describes it with {@link describeUploadError}).
 *
 * @param input - The file, the entity, its id, the role and the translator.
 * @returns The new row, or the message for a refused `addMedia`.
 */
export async function uploadAndAddContentMedia({
    file,
    entity,
    entityId,
    role,
    t
}: {
    readonly file: File;
    readonly entity: ContentMediaEntity;
    readonly entityId: string;
    readonly role: 'featured' | 'gallery';
    readonly t: ContentMediaTranslate;
}): Promise<UploadAndAddOutcome> {
    const uploaded = await uploadEntityImage({ file, entity, entityId, role });
    const addResult = await contentMediaApi.addMedia({
        entity,
        id: entityId,
        body: { url: uploaded.url, publicId: uploaded.publicId, moderationState: 'APPROVED' }
    });
    if (!addResult.ok) {
        return {
            ok: false,
            message:
                visibleApiMessage({ error: addResult.error }) ??
                t(
                    'account.myContent.editor.media.persistFailed',
                    'No se pudo guardar la imagen en la base de datos'
                )
        };
    }
    return { ok: true, row: addResult.data.media };
}

/**
 * Turns an upload failure into a message worth showing. A timeout gets its own
 * localized sentence instead of the browser's English abort text.
 *
 * @param err - The thrown value.
 * @param t - Active translator.
 * @returns A user-facing message.
 */
export function describeUploadError(err: unknown, t: ContentMediaTranslate): string {
    if (err instanceof UploadTimeoutError) {
        return t(
            'account.myContent.editor.media.uploadTimeout',
            'La subida tardó demasiado. Probá de nuevo.'
        );
    }
    return describeUploadEntityError({
        err,
        t,
        fallback: t('account.myContent.editor.media.uploadFailed', 'Error al subir la imagen')
    });
}

/**
 * Validates a selected file.
 *
 * @param input - The file and the translator.
 * @returns A localized error message, or `null` when the file is acceptable.
 */
export function validateContentMediaFile({
    file,
    t
}: {
    readonly file: File;
    readonly t: ContentMediaTranslate;
}): string | null {
    if (!CONTENT_MEDIA_ALLOWED_TYPES.includes(file.type)) {
        return t(
            'account.myContent.editor.media.invalidType',
            'Solo se permiten archivos JPG, PNG o WebP'
        );
    }
    if (file.size > MAX_SIZE_BYTES) {
        return t(
            'account.myContent.editor.media.tooLarge',
            'El archivo no puede superar {{maxSize}}MB',
            { maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB }
        );
    }
    return null;
}
