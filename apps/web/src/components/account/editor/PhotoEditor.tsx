/** Shared photo-section composition; callers retain upload and persistence ownership. */
import type { ReactNode } from 'react';
import { Field, MediaDropzone, PhotoGrid, Section } from '@/components/account/ui';
import type { HelpAnchor } from '@/components/account/ui/help-anchor';
import type { MediaDropzoneProps } from '@/components/account/ui/MediaManager';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './PhotoEditor.module.css';

/** Slots and controls supplied by the vertical-specific photo adapter. */
export interface PhotoEditorProps {
    readonly locale: SupportedLocale;
    readonly helpId: HelpAnchor;
    readonly id?: string;
    readonly description?: ReactNode;
    readonly featured: ReactNode;
    readonly gallery: ReactNode;
    readonly galleryLabel: ReactNode;
    /** Accepted formats and the REAL size cap (HOS-322); never hard-coded here. */
    readonly uploadHint: string;
    readonly galleryInputId: string;
    readonly galleryInput: ReactNode;
    readonly galleryPicker?: MediaDropzoneProps;
    readonly galleryNotice?: ReactNode;
    readonly status?: ReactNode;
    readonly children?: ReactNode;
}

/** Renders one kit Section with the cover, gallery, labelled add tile and Field hint. */
export function PhotoEditor({
    locale,
    helpId,
    id,
    description,
    featured,
    gallery,
    galleryLabel,
    uploadHint,
    galleryInputId,
    galleryInput,
    galleryPicker,
    galleryNotice,
    status,
    children
}: PhotoEditorProps) {
    const { t } = createTranslations(locale);
    return (
        <Section
            id={id}
            helpId={helpId}
            title={t(
                'account.myContent.editor.media.photoSectionTitle',
                'Portada y galería de fotos'
            )}
        >
            <div className={styles.stack}>
                {description}
                {featured}
                {status}
                <Field
                    locale={locale}
                    id={galleryInputId}
                    label={galleryLabel}
                    hint={uploadHint}
                >
                    {galleryNotice}
                    <PhotoGrid>
                        {gallery}
                        {galleryPicker ? (
                            <MediaDropzone
                                {...galleryPicker}
                                variant="tile"
                            />
                        ) : null}
                    </PhotoGrid>
                    {galleryInput}
                </Field>
                {children}
            </div>
        </Section>
    );
}
