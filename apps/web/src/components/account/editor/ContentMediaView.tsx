/**
 * @file ContentMediaView.tsx
 * @description Markup of `ContentMediaSection` (featured image + gallery of a
 * post or event), split out for HOS-2505 so the island stays under the
 * 500-line limit. Stateless: every value and handler comes from the island.
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB } from '@repo/media';
import type { ChangeEvent, JSX, RefObject } from 'react';
import fieldStyles from '@/components/account/editor/content-editor-fields.module.css';
import { PhotoMetadataEditor } from '@/components/host/editor/PhotoMetadataEditor.client';
import type { PhotoMetadataUpdateBody } from '@/components/host/editor/photo-section-helpers';
import type { SupportedLocale } from '@/lib/i18n';
import styles from './ContentMediaSection.module.css';
import type { ContentMediaItem, ContentMediaTranslate } from './content-media-upload';

/** Props of {@link ContentMediaView}. */
export interface ContentMediaViewProps {
    readonly locale: SupportedLocale;
    readonly t: ContentMediaTranslate;
    readonly tPlural: (key: string, count: number, params?: Record<string, unknown>) => string;
    readonly featuredItem: ContentMediaItem | null;
    readonly galleryItems: readonly ContentMediaItem[];
    readonly galleryCap: number;
    readonly isGalleryFull: boolean;
    readonly anyOpInFlight: boolean;
    readonly canWrite: boolean;
    readonly error: string | null;
    readonly featuredInputRef: RefObject<HTMLInputElement | null>;
    readonly galleryInputRef: RefObject<HTMLInputElement | null>;
    readonly handleFeaturedSelect: (event: ChangeEvent<HTMLInputElement>) => void;
    readonly handleGallerySelect: (event: ChangeEvent<HTMLInputElement>) => void;
    readonly handleFeaturedRemove: () => void;
    readonly handleGalleryRemove: (item: ContentMediaItem) => void;
    readonly handleUpdateText: (
        item: ContentMediaItem,
        body: PhotoMetadataUpdateBody
    ) => Promise<boolean>;
}

/**
 * Renders the featured image, the gallery and the inline error.
 *
 * @param props - See {@link ContentMediaViewProps}.
 * @returns The section markup.
 */
export function ContentMediaView({
    locale,
    t,
    tPlural,
    featuredItem,
    galleryItems,
    galleryCap,
    isGalleryFull,
    anyOpInFlight,
    canWrite,
    error,
    featuredInputRef,
    galleryInputRef,
    handleFeaturedSelect,
    handleGallerySelect,
    handleFeaturedRemove,
    handleGalleryRemove,
    handleUpdateText
}: ContentMediaViewProps): JSX.Element {
    const featuredLabel = t('account.myContent.editor.media.featured', 'Imagen principal');
    const galleryLabel = t('account.myContent.editor.media.gallery', 'Galería de fotos');
    const removeLabel = t('account.myContent.editor.media.remove', 'Eliminar');
    const addLabel = t('account.myContent.editor.media.add', 'Agregar foto');
    // The panel's own copy is reused verbatim from the accommodation editor —
    // it is the same form, asking the same five questions, so a second set of
    // strings would only be a second thing to keep translated. That includes
    // these accessible names, which describe the panel, not the entity.
    const featuredToggleAria = t(
        'host.properties.editor.photo.editFeaturedDetailsAria',
        'Editar textos de la portada'
    );
    const featuredCloseAria = t(
        'host.properties.editor.photo.closeFeaturedDetailsAria',
        'Cerrar edición de textos de la portada'
    );

    return (
        <div className={styles.media}>
            <div className={styles.mediaGroup}>
                <span className={fieldStyles.label}>{featuredLabel}</span>
                {featuredItem ? (
                    <div className={styles.mediaItem}>
                        <div className={styles.mediaThumb}>
                            <img
                                src={featuredItem.url}
                                alt={featuredItem.alt ?? featuredLabel}
                                className={styles.mediaImage}
                            />
                            <button
                                type="button"
                                className={styles.mediaRemove}
                                aria-label={removeLabel}
                                disabled={anyOpInFlight || !canWrite || !featuredItem.id}
                                onClick={handleFeaturedRemove}
                            >
                                ×
                            </button>
                        </div>
                        <PhotoMetadataEditor
                            locale={locale}
                            item={featuredItem}
                            disabled={anyOpInFlight || !canWrite}
                            toggleAriaLabel={featuredToggleAria}
                            closeAriaLabel={featuredCloseAria}
                            onSave={handleUpdateText}
                        />
                    </div>
                ) : (
                    <button
                        type="button"
                        className={styles.mediaAdd}
                        disabled={anyOpInFlight || !canWrite}
                        onClick={() => featuredInputRef.current?.click()}
                    >
                        {addLabel}
                    </button>
                )}
                <input
                    ref={featuredInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label={featuredLabel}
                    className={styles.mediaFileInput}
                    disabled={!canWrite}
                    onChange={handleFeaturedSelect}
                />
            </div>

            <div className={styles.mediaGroup}>
                <span className={fieldStyles.label}>{galleryLabel}</span>
                <div className={styles.mediaGallery}>
                    {galleryItems.map((image, index) => (
                        <div
                            key={image.id || image.url}
                            className={styles.mediaItem}
                        >
                            <div className={styles.mediaThumb}>
                                <img
                                    src={image.url}
                                    alt={image.alt ?? galleryLabel}
                                    className={styles.mediaImage}
                                />
                                <button
                                    type="button"
                                    className={styles.mediaRemove}
                                    aria-label={removeLabel}
                                    disabled={anyOpInFlight || !canWrite || !image.id}
                                    onClick={() => handleGalleryRemove(image)}
                                >
                                    ×
                                </button>
                            </div>
                            <PhotoMetadataEditor
                                locale={locale}
                                item={image}
                                disabled={anyOpInFlight || !canWrite}
                                compactLayout={true}
                                toggleAriaLabel={t(
                                    'host.properties.editor.photo.editDetailsAria',
                                    'Editar textos de la foto {{index}}',
                                    { index: index + 1 }
                                )}
                                closeAriaLabel={t(
                                    'host.properties.editor.photo.closeDetailsAria',
                                    'Cerrar edición de textos de la foto {{index}}',
                                    { index: index + 1 }
                                )}
                                onSave={handleUpdateText}
                            />
                        </div>
                    ))}
                    {!isGalleryFull && (
                        <button
                            type="button"
                            className={styles.mediaAdd}
                            disabled={anyOpInFlight || !canWrite}
                            aria-label={addLabel}
                            onClick={() => galleryInputRef.current?.click()}
                        >
                            +
                        </button>
                    )}
                </div>
                <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label={galleryLabel}
                    className={styles.mediaFileInput}
                    disabled={!canWrite}
                    onChange={handleGallerySelect}
                />
                <span className={styles.mediaHint}>
                    {tPlural('account.myContent.editor.media.uploadHint', galleryCap, {
                        cap: galleryCap,
                        maxSize: DEFAULT_ENTITY_MAX_FILE_SIZE_MB
                    })}
                </span>
            </div>

            {error && (
                <p
                    className={fieldStyles.error}
                    role="alert"
                >
                    {error}
                </p>
            )}
        </div>
    );
}
