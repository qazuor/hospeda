import { TagIcon } from '@repo/icons';
import type { QrCodeTag } from '@repo/schemas';
import type { ReactNode } from 'react';
import { PostTagColorBadge } from '@/components/tags/PostTagColorBadge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQrCodeTagCatalog } from '@/features/qr-codes/hooks/useQrCodeTags';
import { useTranslations } from '@/hooks/use-translations';

/**
 * A controlled multi-select over the QR tag catalog (HOS-2679).
 *
 * Shared by the list filter, the row's tag editor and the QR form, so all three
 * read the same catalog and the same empty state. It owns no persistence: the
 * caller decides whether a change is a filter, a PUT, or part of a form submit.
 */

/** Props for {@link QrCodeTagPicker}. */
export type QrCodeTagPickerProps = {
    /** Selected tag ids. */
    readonly value: readonly string[];
    /** Receives the full new selection. */
    readonly onChange: (next: readonly string[]) => void;
    /** Trigger text; defaults to the generic "Etiquetas". */
    readonly triggerLabel?: string;
    /** Disables the trigger. */
    readonly disabled?: boolean;
    /** `id` for the trigger, so a `<Label htmlFor>` can point at it. */
    readonly id?: string;
    /** Controlled open state (optional). */
    readonly open?: boolean;
    /** Controlled open callback (optional). */
    readonly onOpenChange?: (open: boolean) => void;
    /** Extra content under the list (e.g. a save button). */
    readonly footer?: ReactNode;
};

/**
 * Toggles one id in a selection.
 *
 * @param input.value - Current selection.
 * @param input.id - Id to toggle.
 * @returns The new selection, in catalog-independent insertion order.
 */
export function toggleTagId(input: {
    readonly value: readonly string[];
    readonly id: string;
}): readonly string[] {
    return input.value.includes(input.id)
        ? input.value.filter((existing) => existing !== input.id)
        : [...input.value, input.id];
}

/**
 * True when two tag selections differ as SETS (order is irrelevant).
 *
 * @param input.before - The selection the form opened with.
 * @param input.after - The selection being saved.
 * @returns Whether a PUT is needed.
 */
export function tagSelectionChanged(input: {
    readonly before: readonly string[];
    readonly after: readonly string[];
}): boolean {
    const before = new Set(input.before);
    const after = new Set(input.after);
    if (before.size !== after.size) return true;
    for (const id of after) {
        if (!before.has(id)) return true;
    }
    return false;
}

/** One checkbox row of the catalog. */
function TagOption({
    tag,
    checked,
    onToggle
}: {
    readonly tag: QrCodeTag;
    readonly checked: boolean;
    readonly onToggle: () => void;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
            <input
                type="checkbox"
                className="h-4 w-4"
                checked={checked}
                onChange={onToggle}
            />
            {tag.color ? <PostTagColorBadge color={tag.color} /> : null}
            <span className="truncate">{tag.name}</span>
        </label>
    );
}

/**
 * Renders the picker trigger and its popover list.
 *
 * @param props - {@link QrCodeTagPickerProps}
 * @returns The picker.
 */
export function QrCodeTagPicker({
    value,
    onChange,
    triggerLabel,
    disabled = false,
    id,
    open,
    onOpenChange,
    footer
}: QrCodeTagPickerProps) {
    const { t } = useTranslations();
    const { data: catalog = [], isLoading } = useQrCodeTagCatalog();

    const label = triggerLabel ?? t('admin-qr-codes.tags.pickerTrigger');
    const count = value.length;

    return (
        <Popover
            open={open}
            onOpenChange={onOpenChange}
        >
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                >
                    <TagIcon
                        className="mr-1 h-3.5 w-3.5"
                        aria-hidden="true"
                    />
                    {count > 0 ? `${label} (${count})` : label}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-64 space-y-2"
                align="start"
            >
                {isLoading ? (
                    <p className="text-muted-foreground text-sm">
                        {t('admin-common.states.loading')}
                    </p>
                ) : catalog.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        {t('admin-qr-codes.tags.emptyCatalog')}
                    </p>
                ) : (
                    <div className="max-h-64 space-y-0.5 overflow-y-auto">
                        {catalog.map((tag) => (
                            <TagOption
                                key={tag.id}
                                tag={tag}
                                checked={value.includes(tag.id)}
                                onToggle={() => onChange(toggleTagId({ value, id: tag.id }))}
                            />
                        ))}
                    </div>
                )}
                {footer}
            </PopoverContent>
        </Popover>
    );
}
