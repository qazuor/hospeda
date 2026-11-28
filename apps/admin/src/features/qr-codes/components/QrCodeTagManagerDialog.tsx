import { DeleteIcon, SettingsIcon } from '@repo/icons';
import { type QrCodeTag, TagColorEnum } from '@repo/schemas';
import { useState } from 'react';
import { PostTagColorBadge } from '@/components/tags/PostTagColorBadge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    useCreateQrCodeTag,
    useDeleteQrCodeTag,
    useQrCodeTagCatalog,
    useUpdateQrCodeTag
} from '@/features/qr-codes/hooks/useQrCodeTags';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';

/**
 * Manage the QR tag catalog (HOS-2679): create, rename, recolour, delete.
 *
 * Gated by the caller on the QR permissions — the catalog has no family of its
 * own. A name that slugs onto another live tag is refused by the API (409) and
 * surfaces here as a toast; the slug itself is never shown or typed.
 */

/** The Select value for "no colour". Radix refuses an empty-string item. */
const NO_COLOR = 'NONE';

/** Props for {@link QrCodeTagManagerDialog}. */
export type QrCodeTagManagerDialogProps = {
    /** May create tags (QR_CODE_CREATE). */
    readonly canCreate: boolean;
    /** May rename / recolour tags (QR_CODE_UPDATE). */
    readonly canUpdate: boolean;
    /** May delete tags (QR_CODE_DELETE). */
    readonly canDelete: boolean;
};

/** A colour Select shared by the create row and each tag row. */
function ColorSelect({
    value,
    onChange,
    disabled,
    ariaLabel
}: {
    readonly value: TagColorEnum | null;
    readonly onChange: (next: TagColorEnum | null) => void;
    readonly disabled?: boolean;
    readonly ariaLabel: string;
}) {
    const { t } = useTranslations();
    return (
        <Select
            value={value ?? NO_COLOR}
            onValueChange={(next) => onChange(next === NO_COLOR ? null : (next as TagColorEnum))}
            disabled={disabled}
        >
            <SelectTrigger
                className="h-9 w-36"
                aria-label={ariaLabel}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NO_COLOR}>{t('admin-qr-codes.tags.noColor')}</SelectItem>
                {Object.values(TagColorEnum).map((color) => (
                    <SelectItem
                        key={color}
                        value={color}
                    >
                        <PostTagColorBadge
                            color={color}
                            label={t(`admin-qr-codes.tags.colors.${color}`)}
                        />
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/** One editable row of the catalog. */
function TagRow({
    tag,
    canUpdate,
    canDelete,
    onAskDelete
}: {
    readonly tag: QrCodeTag;
    readonly canUpdate: boolean;
    readonly canDelete: boolean;
    readonly onAskDelete: (tag: QrCodeTag) => void;
}) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const updateTag = useUpdateQrCodeTag();
    const [name, setName] = useState(tag.name);

    const save = async (data: { name?: string; color?: TagColorEnum | null }) => {
        try {
            await updateTag.mutateAsync({ id: tag.id, data });
            addToast({ message: t('admin-qr-codes.tags.updated'), variant: 'success' });
        } catch {
            setName(tag.name);
            addToast({ message: t('admin-qr-codes.tags.updateError'), variant: 'error' });
        }
    };

    const commitName = () => {
        const trimmed = name.trim();
        if (trimmed === '' || trimmed === tag.name) {
            setName(tag.name);
            return;
        }
        void save({ name: trimmed });
    };

    return (
        <li className="flex items-center gap-2">
            <Input
                value={name}
                aria-label={t('admin-qr-codes.tags.nameLabel')}
                disabled={!canUpdate || updateTag.isPending}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commitName();
                    }
                }}
            />
            <ColorSelect
                value={tag.color}
                disabled={!canUpdate || updateTag.isPending}
                ariaLabel={t('admin-qr-codes.tags.colorLabel')}
                onChange={(color) => void save({ color })}
            />
            {canDelete ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t('admin-qr-codes.tags.delete')}
                    onClick={() => onAskDelete(tag)}
                >
                    <DeleteIcon
                        className="h-4 w-4"
                        aria-hidden="true"
                    />
                </Button>
            ) : null}
        </li>
    );
}

/**
 * Renders the trigger button and the catalog dialog.
 *
 * @param props - {@link QrCodeTagManagerDialogProps}
 * @returns The dialog.
 */
export function QrCodeTagManagerDialog({
    canCreate,
    canUpdate,
    canDelete
}: QrCodeTagManagerDialogProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const { data: catalog = [], isLoading } = useQrCodeTagCatalog();
    const createTag = useCreateQrCodeTag();
    const deleteTag = useDeleteQrCodeTag();
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState<TagColorEnum | null>(null);
    const [pendingDelete, setPendingDelete] = useState<QrCodeTag | null>(null);

    const handleCreate = async () => {
        const name = newName.trim();
        if (name === '') return;
        try {
            await createTag.mutateAsync(newColor ? { name, color: newColor } : { name });
            setNewName('');
            setNewColor(null);
            addToast({ message: t('admin-qr-codes.tags.created'), variant: 'success' });
        } catch {
            addToast({ message: t('admin-qr-codes.tags.createError'), variant: 'error' });
        }
    };

    const handleDelete = async () => {
        if (!pendingDelete) return;
        try {
            await deleteTag.mutateAsync(pendingDelete.id);
            addToast({ message: t('admin-qr-codes.tags.deleted'), variant: 'success' });
        } catch {
            addToast({ message: t('admin-qr-codes.tags.deleteError'), variant: 'error' });
        } finally {
            setPendingDelete(null);
        }
    };

    return (
        <>
            <Dialog>
                <DialogTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                    >
                        <SettingsIcon
                            className="mr-2 h-4 w-4"
                            aria-hidden="true"
                        />
                        {t('admin-qr-codes.tags.manage')}
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{t('admin-qr-codes.tags.manageTitle')}</DialogTitle>
                        <DialogDescription>{t('admin-qr-codes.tags.manageHelp')}</DialogDescription>
                    </DialogHeader>

                    {canCreate ? (
                        <form
                            className="flex items-center gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void handleCreate();
                            }}
                        >
                            <Input
                                value={newName}
                                placeholder={t('admin-qr-codes.tags.newPlaceholder')}
                                aria-label={t('admin-qr-codes.tags.nameLabel')}
                                maxLength={80}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                            <ColorSelect
                                value={newColor}
                                ariaLabel={t('admin-qr-codes.tags.colorLabel')}
                                onChange={setNewColor}
                            />
                            <Button
                                type="submit"
                                disabled={createTag.isPending || newName.trim() === ''}
                            >
                                {t('admin-qr-codes.tags.add')}
                            </Button>
                        </form>
                    ) : null}

                    {isLoading ? (
                        <p className="text-muted-foreground text-sm">
                            {t('admin-common.states.loading')}
                        </p>
                    ) : catalog.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            {t('admin-qr-codes.tags.emptyCatalog')}
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {catalog.map((tag) => (
                                <TagRow
                                    key={`${tag.id}:${tag.name}`}
                                    tag={tag}
                                    canUpdate={canUpdate}
                                    canDelete={canDelete}
                                    onAskDelete={setPendingDelete}
                                />
                            ))}
                        </ul>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingDelete(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('admin-qr-codes.tags.deleteTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('admin-qr-codes.tags.deleteConfirm', {
                                name: pendingDelete?.name ?? ''
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('admin-qr-codes.actions.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>
                            {t('admin-qr-codes.tags.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
