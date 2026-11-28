import type { QrCodeTagRef } from '@repo/schemas';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSetQrCodeTags } from '@/features/qr-codes/hooks/useQrCodeTags';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { QrCodeTagPicker } from './QrCodeTagPicker';

/**
 * The tags of one row, with an inline editor (HOS-2679).
 *
 * The selection is a DRAFT until "Guardar": ticking boxes in a popover and
 * firing a PUT per tick would race against itself, and the endpoint replaces the
 * complete set anyway.
 */

/** Props for {@link QrCodeTagsCell}. */
export type QrCodeTagsCellProps = {
    /** The row's id. */
    readonly qrCodeId: string;
    /** The tags the row carries. */
    readonly tags: readonly QrCodeTagRef[];
    /** Whether the viewer may change them (QR_CODE_UPDATE). */
    readonly canEdit: boolean;
};

/**
 * Renders the row's tags and, when allowed, the picker that replaces them.
 *
 * @param props - {@link QrCodeTagsCellProps}
 * @returns The cell.
 */
export function QrCodeTagsCell({ qrCodeId, tags, canEdit }: QrCodeTagsCellProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const setTags = useSetQrCodeTags();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<readonly string[]>(() => tags.map((tag) => tag.id));

    const handleOpenChange = (next: boolean) => {
        if (next) setDraft(tags.map((tag) => tag.id));
        setOpen(next);
    };

    const handleSave = async () => {
        try {
            await setTags.mutateAsync({ id: qrCodeId, tagIds: draft });
            addToast({ message: t('admin-qr-codes.tags.saved'), variant: 'success' });
            setOpen(false);
        } catch {
            addToast({ message: t('admin-qr-codes.tags.saveError'), variant: 'error' });
        }
    };

    return (
        <div className="flex min-w-32 flex-wrap items-center gap-1">
            {tags.map((tag) => (
                <Badge
                    key={tag.id}
                    variant="secondary"
                >
                    {tag.name}
                </Badge>
            ))}
            {canEdit ? (
                <QrCodeTagPicker
                    value={draft}
                    onChange={setDraft}
                    triggerLabel={t('admin-qr-codes.tags.editTrigger')}
                    open={open}
                    onOpenChange={handleOpenChange}
                    footer={
                        <div className="flex justify-end gap-2 border-t pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setOpen(false)}
                            >
                                {t('admin-qr-codes.actions.cancel')}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                disabled={setTags.isPending}
                                onClick={handleSave}
                            >
                                {t('admin-qr-codes.tags.save')}
                            </Button>
                        </div>
                    }
                />
            ) : tags.length === 0 ? (
                <span className="text-muted-foreground text-xs">—</span>
            ) : null}
        </div>
    );
}
