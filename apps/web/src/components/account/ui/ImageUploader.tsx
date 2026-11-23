/**
 * ImageUploader — pick or drop one image, check it, shrink it and upload it
 * (HOS-2506, spec §6.1 «AvatarUploader-style»).
 *
 * A {@link Field} around a drop zone. The visible button is the labelled
 * control (the Field label points at it, and its accessible name adds the action), the file input is only the native
 * picker behind it. For every chosen file it:
 *
 * 1. checks the type against `acceptedTypes` and shows a field error when it
 *    does not match, before anything is read;
 * 2. shows a local preview straight away, so the person sees the image before
 *    anything is saved;
 * 3. recompresses it in the browser (`compressImageForUpload`; never blocks:
 *    an unsupported format falls back to the original file);
 * 4. checks the size AFTER compression against `maxBytes`, so a heavy original
 *    that shrinks under the cap is accepted;
 * 5. hands the file to the caller's `upload` and reports the resulting URL
 *    through `onChange`.
 *
 * The piece never persists anything and knows no endpoint: `upload` is the
 * caller's. A failed pick keeps the previous `value`.
 *
 * @module components/account/ui/ImageUploader
 */

import { ImageIcon, UploadIcon } from '@repo/icons';
import {
    type ChangeEvent,
    type DragEvent,
    type ReactNode,
    useEffect,
    useRef,
    useState
} from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { compressImageForUpload, isCompressionUnavailable } from '@/lib/media/compress-image';
import { Button } from './Button';
import { Field } from './Field';
import { useFieldControl } from './field-context';
import type { HelpAnchor } from './help-anchor';
import styles from './ImageUploader.module.css';

/** Result of the caller's upload: the stored URL, or a message to show. */
export type ImageUploadResult =
    | { readonly ok: true; readonly url: string }
    | { readonly ok: false; readonly message?: string };

/** Props of {@link ImageUploader}. */
export interface ImageUploaderProps {
    /** Visible field label. */
    readonly label: string;
    /** Locale for the piece's own copy. */
    readonly locale: SupportedLocale;
    /** Current image URL (saved or pending), or empty. */
    readonly value: string | null;
    /** Called with the URL after a successful upload. */
    readonly onChange: (url: string) => void;
    /** Uploads one (already compressed) file. Never persists the field itself. */
    readonly upload: (file: File) => Promise<ImageUploadResult>;
    /** MIME types the picker accepts. @default PNG, JPEG, WebP */
    readonly acceptedTypes?: readonly string[];
    /** Largest accepted file, in bytes, checked after compression. */
    readonly maxBytes: number;
    /** Same cap in MB, for the copy. */
    readonly maxMb: number;
    /** Alt text of the preview. */
    readonly previewAlt: string;
    /** Extra helper text above the type and size hint. */
    readonly hint?: ReactNode;
    /** Error from the form (for example a failed save); wins over the piece's own. */
    readonly error?: ReactNode;
    /** Disables the picker (for example while the form saves). */
    readonly disabled?: boolean;
    /** Marks the field required. */
    readonly required?: boolean;
    /** Optional help anchor. */
    readonly helpId?: HelpAnchor;
    /** Explicit control id. */
    readonly id?: string;
}

/** Default accepted types: what the media pipeline accepts for entity images. */
export const DEFAULT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** The picker button: the labelled control of the surrounding Field. */
function PickerButton({
    busy,
    disabled,
    onPick,
    name,
    children
}: {
    readonly name: string;
    readonly busy: boolean;
    readonly disabled: boolean;
    readonly onPick: () => void;
    readonly children: ReactNode;
}) {
    const control = useFieldControl({});
    return (
        <Button
            {...control}
            aria-label={name}
            variant="secondary"
            disabled={disabled}
            aria-busy={busy || undefined}
            onClick={() => {
                if (!busy) onPick();
            }}
        >
            <UploadIcon
                size="sm"
                aria-hidden="true"
            />
            {children}
        </Button>
    );
}

/** Short label of a MIME type for the hint («image/jpeg» to «JPG»). */
function typeLabel(mime: string): string {
    const sub = mime.split('/')[1] ?? mime;
    return (sub === 'jpeg' ? 'jpg' : sub).toUpperCase();
}

/**
 * The kit image uploader.
 *
 * @param props - See {@link ImageUploaderProps}.
 * @returns A {@link Field} holding the preview, the picker and the drop zone.
 */
export function ImageUploader({
    label,
    locale,
    value,
    onChange,
    upload,
    acceptedTypes = DEFAULT_IMAGE_TYPES,
    maxBytes,
    maxMb,
    previewAlt,
    hint,
    error,
    disabled = false,
    required,
    helpId,
    id
}: ImageUploaderProps) {
    const t = createT(locale);
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [phase, setPhase] = useState<'idle' | 'compressing' | 'uploading'>('idle');
    const [ownError, setOwnError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const lastUploaded = useRef<string | null>(null);
    const previewRef = useRef<string | null>(null);
    previewRef.current = preview;

    // A value that changed under us (discard, save) drops the local preview.
    useEffect(() => {
        if (value !== lastUploaded.current && previewRef.current !== null) {
            URL.revokeObjectURL(previewRef.current);
            setPreview(null);
        }
    }, [value]);

    useEffect(
        () => () => {
            if (previewRef.current !== null) URL.revokeObjectURL(previewRef.current);
        },
        []
    );

    const busy = phase !== 'idle';
    const shownError = error ?? ownError;
    const typesHint = acceptedTypes.map(typeLabel).join(', ');

    function replacePreview(next: string | null): void {
        if (previewRef.current !== null) URL.revokeObjectURL(previewRef.current);
        setPreview(next);
    }

    async function handleFile(file: File): Promise<void> {
        setOwnError(null);
        if (!acceptedTypes.includes(file.type)) {
            setOwnError(
                t('account.ui.imageUploader.errors.invalidType', undefined, { types: typesHint })
            );
            return;
        }
        replacePreview(URL.createObjectURL(file));
        try {
            setPhase('compressing');
            const compression = await compressImageForUpload({ file });
            const candidate = compression.file;
            if (candidate.size > maxBytes) {
                replacePreview(null);
                setOwnError(
                    isCompressionUnavailable(compression)
                        ? t('account.ui.imageUploader.errors.tooLargeNoCompression', undefined, {
                              maxSize: maxMb
                          })
                        : t('account.ui.imageUploader.errors.tooLarge', undefined, {
                              maxSize: maxMb
                          })
                );
                return;
            }
            setPhase('uploading');
            const result = await upload(candidate);
            if (!result.ok) {
                replacePreview(null);
                setOwnError(result.message ?? t('account.ui.imageUploader.errors.uploadFailed'));
                return;
            }
            lastUploaded.current = result.url;
            onChange(result.url);
        } catch {
            replacePreview(null);
            setOwnError(t('account.ui.imageUploader.errors.uploadFailed'));
        } finally {
            setPhase('idle');
        }
    }

    function handleInput(event: ChangeEvent<HTMLInputElement>): void {
        const file = event.target.files?.[0];
        // Reset so the same file can be picked again after an error.
        event.target.value = '';
        if (file) void handleFile(file);
    }

    function handleDrop(event: DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        setDragging(false);
        if (disabled || busy) return;
        const file = event.dataTransfer.files?.[0];
        if (file) void handleFile(file);
    }

    const shownSrc = preview ?? (value ? value : null);
    const buttonLabel = busy
        ? t(`account.ui.imageUploader.${phase}`)
        : shownSrc
          ? t('account.ui.imageUploader.replace')
          : t('account.ui.imageUploader.choose');

    return (
        <Field
            label={label}
            locale={locale}
            id={id}
            required={required}
            helpId={helpId}
            error={shownError}
            hint={
                <>
                    {hint ? <>{hint} </> : null}
                    {t('account.ui.imageUploader.hint', undefined, {
                        types: typesHint,
                        maxSize: maxMb
                    })}
                </>
            }
        >
            {/* biome-ignore lint/a11y/noStaticElementInteractions: drop target only; the button inside is the keyboard path */}
            <div
                className={styles.zone}
                data-dragging={dragging}
                data-invalid={shownError ? 'true' : undefined}
                data-testid="image-uploader-zone"
                onDragEnter={(e) => {
                    e.preventDefault();
                    if (!disabled && !busy) setDragging(true);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
            >
                <div className={styles.preview}>
                    {shownSrc ? (
                        <img
                            className={styles.image}
                            src={shownSrc}
                            alt={previewAlt}
                            data-testid="image-uploader-preview"
                        />
                    ) : (
                        <ImageIcon
                            size="lg"
                            aria-hidden="true"
                        />
                    )}
                </div>
                <div className={styles.body}>
                    <PickerButton
                        name={`${label}: ${buttonLabel}`}
                        busy={busy}
                        disabled={disabled}
                        onPick={() => inputRef.current?.click()}
                    >
                        {buttonLabel}
                    </PickerButton>
                    <p className={styles.dropHint}>{t('account.ui.imageUploader.dropHint')}</p>
                </div>
                <p
                    role="status"
                    className={styles.visuallyHidden}
                >
                    {busy ? t(`account.ui.imageUploader.${phase}`) : ''}
                </p>
                <input
                    ref={inputRef}
                    className={styles.fileInput}
                    type="file"
                    accept={acceptedTypes.join(',')}
                    onChange={handleInput}
                    tabIndex={-1}
                    aria-hidden="true"
                    disabled={disabled || busy}
                    data-testid="image-uploader-input"
                />
            </div>
        </Field>
    );
}
