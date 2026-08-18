/**
 * GalleryPhotoTextDialog
 *
 * Lets a staff member correct the text that travels with one gallery photo —
 * `alt`, `caption`, `description` (HOS-388).
 *
 * The host writes this text in their own editor; this exists for the case the
 * host cannot fix: a moderator looking at a listing that is not theirs, with an
 * `alt` that is wrong, misleading, or in the wrong language. Before the admin
 * PATCH route the only remedy was deleting the photo and re-uploading it, which
 * burned a second Cloudinary asset and lost the photo's position.
 *
 * `attribution` is deliberately absent: it is a composed stock-image credit, not
 * something a moderator types over someone else's photo.
 *
 * All patch-building rules (only changed fields travel, an emptied field becomes
 * `null` rather than `''`, whitespace counts as empty) live in
 * `utils/gallery-photo-text.ts` so they can be tested without a DOM.
 */

import type { AccommodationMedia } from '@repo/schemas';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAccommodationMediaUpdateText } from '@/features/accommodations/hooks/useAccommodationMedia';
import {
    buildPhotoTextPatch,
    isEmptyPatch,
    type PhotoTextValues,
    toFormValues
} from '@/features/accommodations/utils/gallery-photo-text';
import { useTranslations } from '@/hooks/use-translations';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for GalleryPhotoTextDialog. */
export interface GalleryPhotoTextDialogProps {
    /** UUID of the accommodation the photo belongs to. */
    readonly accommodationId: string;
    /** The photo being edited, or `null` when the dialog is closed. */
    readonly photo: AccommodationMedia | null;
    /** Closes the dialog. */
    readonly onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal editor for one photo's text metadata.
 *
 * @param accommodationId - UUID of the owning accommodation.
 * @param photo - The photo to edit; `null` keeps the dialog closed.
 * @param onClose - Called on cancel and after a successful save.
 */
export function GalleryPhotoTextDialog({
    accommodationId,
    photo,
    onClose
}: GalleryPhotoTextDialogProps) {
    const { t } = useTranslations();
    const updateText = useAccommodationMediaUpdateText(accommodationId);

    const [values, setValues] = React.useState<PhotoTextValues>(() => toFormValues(photo ?? {}));
    const [saveError, setSaveError] = React.useState<string | null>(null);

    // Re-seed whenever a DIFFERENT photo opens the dialog. Without this the
    // form keeps the previous photo's text, which is the kind of bug that
    // silently writes one photo's alt onto another.
    const photoId = photo?.id;
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-seed keyed on the photo id, not the object identity
    React.useEffect(() => {
        setValues(toFormValues(photo ?? {}));
        setSaveError(null);
    }, [photoId]);

    const setField = (field: keyof PhotoTextValues, value: string) => {
        setValues((prev) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!photo) return;
        setSaveError(null);

        const patch = buildPhotoTextPatch({ stored: photo, next: values });
        if (isEmptyPatch(patch)) {
            // Nothing changed. The endpoint answers VALIDATION_ERROR on an empty
            // body, so sending it would surface an error the moderator did not
            // cause — closing is the honest outcome.
            onClose();
            return;
        }

        try {
            await updateText.mutateAsync({ mediaId: photo.id, patch });
            onClose();
        } catch {
            setSaveError(t('admin-pages.gallery.photoText.errors.saveFailed'));
        }
    };

    return (
        <Dialog
            open={photo !== null}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin-pages.gallery.photoText.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-pages.gallery.photoText.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="photo-text-alt">
                            {t('admin-pages.gallery.photoText.fieldAlt')}
                        </Label>
                        <Input
                            id="photo-text-alt"
                            value={values.alt}
                            onChange={(event) => setField('alt', event.target.value)}
                        />
                        <p className="text-muted-foreground text-xs">
                            {t('admin-pages.gallery.photoText.fieldAltHelp')}
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="photo-text-caption">
                            {t('admin-pages.gallery.photoText.fieldCaption')}
                        </Label>
                        <Input
                            id="photo-text-caption"
                            value={values.caption}
                            onChange={(event) => setField('caption', event.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="photo-text-description">
                            {t('admin-pages.gallery.photoText.fieldDescription')}
                        </Label>
                        <Textarea
                            id="photo-text-description"
                            rows={3}
                            value={values.description}
                            onChange={(event) => setField('description', event.target.value)}
                        />
                    </div>

                    <p className="text-muted-foreground text-xs">
                        {t('admin-pages.gallery.photoText.emptyHint')}
                    </p>

                    {saveError && (
                        <p
                            role="alert"
                            className="text-destructive text-sm"
                        >
                            {saveError}
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={updateText.isPending}
                    >
                        {t('admin-pages.gallery.photoText.actions.cancel')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={updateText.isPending}
                    >
                        {t('admin-pages.gallery.photoText.actions.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
