import { readUtmParams, rewriteUtmParams, UTM_PARAM_KEYS, type UtmParamKey } from '@repo/analytics';
import { EditIcon } from '@repo/icons';
import { type QrCodeAdminListItem, QrCodeSourceEnum } from '@repo/schemas';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUpdateQrCode } from '@/features/qr-codes/hooks/useQrCodes';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';

/**
 * The UTMs of one QR code in the admin list (HOS-2679).
 *
 * The cell always shows `scanUtm`: what a scanner LANDS with, computed by the
 * API from the same rule the redirect uses. For a GENERATED code that is the
 * whole story — its UTMs are derived from the entity at scan time and nothing
 * here can change them, so the cell is read-only.
 *
 * A MANUAL code adds an editor over the UTMs written into its own `targetUrl`.
 * Saving rewrites ONLY those five params ({@link rewriteUtmParams} keeps every
 * other byte of the URL) and PATCHes `targetUrl` through the regular update.
 */

/** Props for {@link QrCodeUtmCell}. */
export type QrCodeUtmCellProps = {
    /** The list row. */
    readonly row: QrCodeAdminListItem;
    /** Whether the viewer may edit (QR_CODE_UPDATE). */
    readonly canEdit: boolean;
};

/** Editable values, one string per UTM key ('' = absent). */
type UtmDraft = Record<UtmParamKey, string>;

/**
 * Builds the editor's starting values from the stored URL.
 *
 * @param input.url - The stored `targetUrl`.
 * @returns One string per key; absent keys become `''`.
 */
export function toUtmDraft(input: { readonly url: string }): UtmDraft {
    const values = readUtmParams({ url: input.url });
    const draft = {} as UtmDraft;
    for (const key of UTM_PARAM_KEYS) {
        draft[key] = values[key] ?? '';
    }
    return draft;
}

/**
 * The new `targetUrl` for an edited draft, or `null` when nothing would change.
 *
 * A blank field REMOVES its key, so clearing every field strips the UTMs and
 * leaves the rest of the URL untouched.
 *
 * @param input.url - The stored `targetUrl`.
 * @param input.draft - The editor's values.
 * @returns The rewritten URL, or `null` for a no-op.
 */
export function buildUtmTargetUrl(input: {
    readonly url: string;
    readonly draft: UtmDraft;
}): string | null {
    const before = toUtmDraft({ url: input.url });
    const changed = UTM_PARAM_KEYS.some((key) => before[key] !== input.draft[key].trim());
    if (!changed) return null;
    const patch: Partial<Record<UtmParamKey, string | null>> = {};
    for (const key of UTM_PARAM_KEYS) {
        patch[key] = input.draft[key].trim() === '' ? null : input.draft[key];
    }
    return rewriteUtmParams({ url: input.url, utm: patch });
}

/** Read-only list of the landing UTMs. */
function UtmList({ values }: { readonly values: QrCodeAdminListItem['scanUtm'] }) {
    const { t } = useTranslations();
    const present = UTM_PARAM_KEYS.filter((key) => values[key]);
    if (present.length === 0) {
        return (
            <span className="text-muted-foreground text-xs">{t('admin-qr-codes.utm.none')}</span>
        );
    }
    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
            {present.map((key) => (
                <div
                    key={key}
                    className="contents"
                >
                    <dt className="text-muted-foreground">{key.replace('utm_', '')}</dt>
                    <dd className="break-all font-mono">{values[key]}</dd>
                </div>
            ))}
        </dl>
    );
}

/**
 * Renders the landing UTMs and, for a MANUAL code, the editor.
 *
 * @param props - {@link QrCodeUtmCellProps}
 * @returns The cell.
 */
export function QrCodeUtmCell({ row, canEdit }: QrCodeUtmCellProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const updateMutation = useUpdateQrCode();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<UtmDraft>(() => toUtmDraft({ url: row.targetUrl }));

    const editable = canEdit && row.source === QrCodeSourceEnum.MANUAL;

    const handleOpenChange = (next: boolean) => {
        // Re-read on every open: the row may have been retargeted since.
        if (next) setDraft(toUtmDraft({ url: row.targetUrl }));
        setOpen(next);
    };

    const handleSave = async () => {
        const targetUrl = buildUtmTargetUrl({ url: row.targetUrl, draft });
        if (targetUrl === null) {
            setOpen(false);
            return;
        }
        try {
            await updateMutation.mutateAsync({ id: row.id, data: { targetUrl } });
            addToast({ message: t('admin-qr-codes.utm.saved'), variant: 'success' });
            setOpen(false);
        } catch {
            addToast({ message: t('admin-qr-codes.utm.saveError'), variant: 'error' });
        }
    };

    return (
        <div className="min-w-40 space-y-1">
            <UtmList values={row.scanUtm} />
            {row.source === QrCodeSourceEnum.GENERATED ? (
                <p className="text-muted-foreground text-xs">
                    {t('admin-qr-codes.utm.generatedHint')}
                </p>
            ) : null}
            {editable ? (
                <Popover
                    open={open}
                    onOpenChange={handleOpenChange}
                >
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                        >
                            <EditIcon
                                className="mr-1 h-3.5 w-3.5"
                                aria-hidden="true"
                            />
                            {t('admin-qr-codes.utm.edit')}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-80 space-y-3"
                        align="start"
                    >
                        <p className="text-muted-foreground text-xs">
                            {t('admin-qr-codes.utm.editHelp')}
                        </p>
                        {UTM_PARAM_KEYS.map((key) => (
                            <div
                                key={key}
                                className="space-y-1"
                            >
                                <Label
                                    htmlFor={`utm-${row.id}-${key}`}
                                    className="font-mono text-xs"
                                >
                                    {key}
                                </Label>
                                <Input
                                    id={`utm-${row.id}-${key}`}
                                    value={draft[key]}
                                    maxLength={200}
                                    onChange={(e) =>
                                        setDraft((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                />
                            </div>
                        ))}
                        <div className="flex justify-end gap-2">
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
                                disabled={updateMutation.isPending}
                                onClick={handleSave}
                            >
                                {t('admin-qr-codes.utm.save')}
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            ) : null}
        </div>
    );
}
