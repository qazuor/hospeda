/**
 * @file AccommodationImageUploader.client.tsx
 * @description React island for uploading accommodation gallery images.
 * Handles file selection, drag-and-drop, per-file upload to the Cloudinary
 * media endpoint, max-images enforcement, and error state per file.
 *
 * Upload endpoint: POST /api/v1/admin/media/upload
 * Request shape: multipart/form-data with fields:
 *   - file       (File)   image binary
 *   - entityType (string) always "accommodation"
 *   - entityId   (string) UUID of the accommodation
 *   - role       (string) always "gallery"
 *
 * Response shape (wrapped by ResponseFactory):
 *   { success: true, data: { url, publicId, width, height, moderationState } }
 *
 * If entityId is not yet available (accommodation not yet created by autosave),
 * new file selections are rejected with an inline error until entityId is set.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useRef, useState } from 'react';
import styles from './AccommodationImageUploader.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default maximum number of gallery images per accommodation. */
const DEFAULT_MAX_IMAGES = 20;

/** Accepted image MIME types (matches API-side validation). */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Maximum file size in bytes (10 MB — matches entity upload limit). */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Upload status for a single queued file. */
export type FileUploadStatus = 'pending' | 'uploading' | 'done' | 'error';

/** Per-file state tracked during and after upload. */
export interface FileUploadEntry {
    /** Local ephemeral ID (not persisted). */
    readonly localId: string;
    /** Original file name for display. */
    readonly fileName: string;
    readonly status: FileUploadStatus;
    /** Cloudinary URL on successful upload. */
    readonly url: string | null;
    /** Error message when status is 'error'. */
    readonly error: string | null;
}

/** Props for AccommodationImageUploader. */
export type AccommodationImageUploaderProps = {
    /**
     * Array of already-uploaded Cloudinary image URLs.
     * Controlled by the parent form via `onChange`.
     */
    readonly value: ReadonlyArray<string>;
    /**
     * Called after each successful upload with the updated full URL array.
     * Parent should call `setValue('photos', newUrls)` or equivalent.
     */
    readonly onChange: (urls: ReadonlyArray<string>) => void;
    /**
     * Accommodation UUID required to associate uploads via the API.
     * May be undefined before the first autosave creates the accommodation.
     * When undefined, new file selections are rejected with an inline message.
     */
    readonly entityId?: string;
    /** API base URL (PUBLIC_API_URL from env). */
    readonly apiUrl: string;
    /** Maximum gallery images allowed. Defaults to 20. */
    readonly maxImages?: number;
    /** Active locale for UI strings. */
    readonly locale?: SupportedLocale;
};

/** Wrapped API response shape from ResponseFactory. */
interface ApiUploadResponse {
    readonly success: boolean;
    readonly data?: {
        readonly url: string;
        readonly publicId: string;
        readonly width: number;
        readonly height: number;
        readonly moderationState: string;
    };
    readonly error?: { readonly message: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a simple ephemeral local ID for tracking in-flight uploads. */
function generateLocalId(): string {
    return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AccommodationImageUploader React island.
 *
 * Provides file selection and drag-and-drop upload to Cloudinary for the
 * property form photos section. Tracks per-file upload state and enforces
 * the gallery image cap. Renders a responsive thumbnail grid with per-thumbnail
 * loading/error overlays and remove buttons.
 *
 * @example
 * ```tsx
 * <AccommodationImageUploader
 *   value={photos}
 *   onChange={setPhotos}
 *   entityId={accommodationId}
 *   apiUrl={PUBLIC_API_URL}
 *   maxImages={20}
 *   locale="es"
 * />
 * ```
 */
export function AccommodationImageUploader({
    value,
    onChange,
    entityId,
    apiUrl,
    maxImages = DEFAULT_MAX_IMAGES,
    locale = 'es'
}: AccommodationImageUploaderProps) {
    const { t } = createTranslations(locale);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [fileEntries, setFileEntries] = useState<ReadonlyArray<FileUploadEntry>>([]);
    const [globalError, setGlobalError] = useState<string | null>(null);

    const base = apiUrl.replace(/\/$/, '');
    const currentCount = value.length;
    const remaining = maxImages - currentCount;
    const isAtCapacity = currentCount >= maxImages;

    // ── Upload function ─────────────────────────────────────────────────────

    /**
     * Uploads a single file to the admin media endpoint.
     * Updates per-entry state throughout the lifecycle.
     */
    const uploadFile = useCallback(
        async (file: File, localId: string): Promise<void> => {
            if (!entityId) {
                // Should be caught before reaching this point, but guard anyway.
                setFileEntries((prev) =>
                    prev.map((e) =>
                        e.localId === localId
                            ? {
                                  ...e,
                                  status: 'error',
                                  error: 'Guardá el borrador primero para habilitar la subida de fotos.'
                              }
                            : e
                    )
                );
                return;
            }

            // Transition to uploading
            setFileEntries((prev) =>
                prev.map((e) => (e.localId === localId ? { ...e, status: 'uploading' } : e))
            );

            const formData = new FormData();
            formData.append('file', file);
            formData.append('entityType', 'accommodation');
            formData.append('entityId', entityId);
            formData.append('role', 'gallery');

            try {
                const response = await fetch(`${base}/api/v1/admin/media/upload`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });

                if (!response.ok) {
                    let message = 'Error al subir la imagen.';
                    try {
                        const errBody = (await response.json()) as ApiUploadResponse;
                        if (errBody.error?.message) message = errBody.error.message;
                    } catch {
                        // ignore JSON parse errors
                    }
                    throw new Error(message);
                }

                const body = (await response.json()) as ApiUploadResponse;

                if (!body.success || !body.data?.url) {
                    throw new Error('Respuesta inesperada del servidor.');
                }

                const newUrl = body.data.url;

                // Mark entry as done
                setFileEntries((prev) =>
                    prev.map((e) =>
                        e.localId === localId ? { ...e, status: 'done', url: newUrl } : e
                    )
                );

                // Notify parent with updated URL array
                onChange([...value, newUrl]);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error desconocido.';
                setFileEntries((prev) =>
                    prev.map((e) =>
                        e.localId === localId ? { ...e, status: 'error', error: message } : e
                    )
                );
            }
        },
        [base, entityId, value, onChange]
    );

    // ── File selection handler ───────────────────────────────────────────────

    /**
     * Processes a FileList, validates each file, enforces capacity,
     * and triggers uploads for valid candidates.
     */
    const processFiles = useCallback(
        (files: FileList | null): void => {
            if (!files || files.length === 0) return;

            setGlobalError(null);

            // Guard: entityId must be present
            if (!entityId) {
                setGlobalError('Guardá el borrador primero para poder subir fotos.');
                return;
            }

            const fileArray = Array.from(files);

            // Enforce capacity before processing
            if (isAtCapacity) {
                setGlobalError(`Alcanzaste el límite de ${maxImages} imágenes.`);
                return;
            }

            const available = remaining;
            const toProcess = fileArray.slice(0, available);
            const rejected = fileArray.slice(available);

            if (rejected.length > 0) {
                setGlobalError(
                    `Solo podés subir ${available} imagen${available !== 1 ? 'es' : ''} más (límite: ${maxImages}).`
                );
            }

            // Validate and queue each file
            const newEntries: FileUploadEntry[] = [];

            for (const file of toProcess) {
                const localId = generateLocalId();

                // MIME type check
                if (!(ACCEPTED_TYPES as ReadonlyArray<string>).includes(file.type)) {
                    newEntries.push({
                        localId,
                        fileName: file.name,
                        status: 'error',
                        url: null,
                        error: `Tipo de archivo no permitido: ${file.type}. Usá JPEG, PNG o WebP.`
                    });
                    continue;
                }

                // File size check
                if (file.size > MAX_FILE_BYTES) {
                    newEntries.push({
                        localId,
                        fileName: file.name,
                        status: 'error',
                        url: null,
                        error: `El archivo excede el límite de ${MAX_FILE_BYTES / 1024 / 1024} MB.`
                    });
                    continue;
                }

                newEntries.push({
                    localId,
                    fileName: file.name,
                    status: 'pending',
                    url: null,
                    error: null
                });
            }

            setFileEntries((prev) => [...prev, ...newEntries]);

            // Trigger uploads for valid (pending) entries.
            // newEntries and toProcess have 1-to-1 index correspondence
            // (each file produces exactly one entry in the same iteration order).
            newEntries.forEach((entry, index) => {
                if (entry.status === 'pending') {
                    const matchedFile = toProcess[index];
                    if (matchedFile) {
                        void uploadFile(matchedFile, entry.localId);
                    }
                }
            });
        },
        [entityId, isAtCapacity, remaining, maxImages, uploadFile]
    );

    // ── Input change handler ─────────────────────────────────────────────────

    function handleInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
        const { files } = event.target;
        // Reset input so the same file can be re-selected after error
        event.target.value = '';
        processFiles(files);
    }

    // ── Button click handler ─────────────────────────────────────────────────

    function handleButtonClick(): void {
        if (isAtCapacity) {
            setGlobalError(`Alcanzaste el límite de ${maxImages} imágenes.`);
            return;
        }
        fileInputRef.current?.click();
    }

    // ── Drag-and-drop handlers ───────────────────────────────────────────────

    function handleDragOver(event: React.DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(true);
    }

    function handleDragEnter(event: React.DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(true);
    }

    function handleDragLeave(event: React.DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
    }

    function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
        processFiles(event.dataTransfer.files);
    }

    // ── Remove handler ───────────────────────────────────────────────────────

    /**
     * Removes an already-uploaded image URL from the controlled value array.
     * Notifies parent via `onChange` with the filtered array.
     */
    function handleRemove(url: string): void {
        onChange(value.filter((u) => u !== url));
    }

    // ── Render ───────────────────────────────────────────────────────────────

    const hasActiveUploads = fileEntries.some(
        (e) => e.status === 'uploading' || e.status === 'pending'
    );

    return (
        <div className={styles.wrapper}>
            {/* "Requires save first" notice — shown when entityId is missing */}
            {!entityId && (
                <output className={styles.requiresSaveNotice}>
                    {t(
                        'host.form.sections.fotos.requiresSaveFirst',
                        'Guardá primero los datos básicos antes de subir fotos'
                    )}
                </output>
            )}

            {/* Dropzone / trigger area */}
            <div
                className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ''} ${isAtCapacity ? styles.dropzoneDisabled : ''}`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                aria-disabled={isAtCapacity}
            >
                {/* Empty state — shown when no images uploaded yet */}
                {value.length === 0 && fileEntries.length === 0 && (
                    <p className={styles.emptyStateText}>
                        {t(
                            'host.form.sections.fotos.uploadPrompt',
                            'Arrastrá fotos acá o hacé click para seleccionar'
                        )}
                    </p>
                )}

                <button
                    type="button"
                    className={styles.selectButton}
                    onClick={handleButtonClick}
                    disabled={isAtCapacity}
                    aria-label={t('host.form.sections.fotos.uploadButton', 'Seleccionar archivos')}
                >
                    {t('host.form.sections.fotos.uploadButton', 'Seleccionar archivos')}
                </button>

                <p className={styles.dropHint}>
                    {isAtCapacity
                        ? t('host.form.sections.fotos.maxReached', 'Llegaste al máximo de 20 fotos')
                        : `o arrastrá las imágenes aquí · JPEG, PNG, WebP · máx. ${MAX_FILE_BYTES / 1024 / 1024} MB por archivo`}
                </p>

                <p
                    className={styles.counter}
                    aria-live="polite"
                >
                    {currentCount} / {maxImages} imágenes
                </p>
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className={styles.fileInput}
                onChange={handleInputChange}
                aria-hidden="true"
                tabIndex={-1}
            />

            {/* Global error or capacity message */}
            {globalError && (
                <p
                    className={styles.errorMsg}
                    role="alert"
                >
                    {globalError}
                </p>
            )}

            {/* Thumbnail grid — already-uploaded images + in-flight uploads */}
            {(value.length > 0 || fileEntries.length > 0) && (
                <div
                    className={styles.thumbnailGrid}
                    aria-label="Galería de fotos subidas"
                >
                    {/* Persisted images */}
                    {value.map((url) => (
                        <div
                            key={url}
                            className={styles.thumbnailCell}
                        >
                            <img
                                src={url}
                                alt=""
                                className={styles.thumbnailImg}
                                loading="lazy"
                            />
                            <button
                                type="button"
                                className={styles.removeBtn}
                                onClick={() => handleRemove(url)}
                                aria-label={t('host.form.sections.fotos.removeAria', 'Quitar foto')}
                            >
                                ×
                            </button>
                        </div>
                    ))}

                    {/* In-flight uploads */}
                    {fileEntries.map((entry) => (
                        <div
                            key={entry.localId}
                            className={`${styles.thumbnailCell} ${entry.status === 'error' ? styles['thumbnailCell--error'] : ''}`}
                            aria-live="polite"
                            aria-label={entry.fileName}
                        >
                            {/* Spinner overlay while uploading / pending */}
                            {(entry.status === 'uploading' || entry.status === 'pending') && (
                                <div
                                    className={styles.uploadingOverlay}
                                    aria-hidden="true"
                                >
                                    <span className={styles.spinner} />
                                </div>
                            )}

                            {/* Error overlay */}
                            {entry.status === 'error' && (
                                <div
                                    className={styles.errorOverlay}
                                    aria-label={
                                        entry.error ??
                                        t(
                                            'host.form.sections.fotos.errorPerFile',
                                            'No se pudo subir esta imagen'
                                        )
                                    }
                                >
                                    ⚠
                                </div>
                            )}

                            {/* Thumbnail visible once done (url is set) */}
                            {entry.status === 'done' && entry.url && (
                                <>
                                    <img
                                        src={entry.url}
                                        alt=""
                                        className={styles.thumbnailImg}
                                        loading="lazy"
                                    />
                                    <button
                                        type="button"
                                        className={styles.removeBtn}
                                        onClick={() => entry.url && handleRemove(entry.url)}
                                        aria-label={t(
                                            'host.form.sections.fotos.removeAria',
                                            'Quitar foto'
                                        )}
                                    >
                                        ×
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Uploading indicator */}
            {hasActiveUploads && (
                <p
                    className={styles.uploadingMsg}
                    aria-live="polite"
                    aria-busy="true"
                >
                    {t('host.form.sections.fotos.uploading', 'Subiendo...')}
                </p>
            )}
        </div>
    );
}
