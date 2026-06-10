import type { BadgeOption } from '@/components/table/DataTable';
import { BadgeCell } from '@/components/table/cells/BadgeCell';
import { Button } from '@/components/ui-wrapped/Button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle
} from '@/components/ui/sheet';
import { useTranslations } from '@/hooks/use-translations';
import { formatShortDate } from '@/lib/format-helpers';
import type { TranslationKey } from '@repo/i18n';

/**
 * Column descriptor used by EntitySummarySheet to render label/value rows.
 * The optional `format` field overrides the automatic type-inference logic in `formatValue`.
 */
export type SummaryColumn = {
    readonly id: string;
    readonly header: string;
    readonly accessorKey: string;
    /**
     * Optional explicit rendering hint:
     * - `'text'` / omitted — String coercion (default).
     * - `'boolean'` — renders as Sí/No.
     * - `'date'` — formats as a short localised date (`DD/MM/YYYY`).
     * - `'list'` — comma-joins array items.
     * - `'badge'` — colored badge using `badgeOptions` value→label+color map.
     * - `'image'` — resolves the accessor to a URL and renders a preview image.
     * - `'address'` — assembles a human-readable address from the `location` object.
     */
    readonly format?: 'text' | 'boolean' | 'date' | 'list' | 'badge' | 'image' | 'address';
    /**
     * Maximum length for text truncation (only when `format` is `'text'` or omitted).
     * Values longer than this are suffixed with `…`.
     */
    readonly maxLength?: number;
    /**
     * Badge options used when `format === 'badge'`. Maps raw enum values to
     * human-readable labels + colors. When absent, the raw value is displayed
     * as plain text inside a default badge shell.
     */
    readonly badgeOptions?: readonly BadgeOption[];
};

/**
 * Props for EntitySummarySheet.
 */
type EntitySummarySheetProps<TData extends Record<string, unknown>> = {
    /** Whether the sheet is open. */
    readonly open: boolean;
    /** Callback fired when the open state should change. */
    readonly onOpenChange: (open: boolean) => void;
    /** The row data to summarise, or null when no row is selected. */
    readonly row: TData | null;
    /** Column descriptors used to render the label/value list. */
    readonly columns: ReadonlyArray<SummaryColumn>;
    /** Title shown in the sheet header (typically the entity name). */
    readonly title: string;
    /** Optional subtitle under the title (e.g. the entity slug). */
    readonly subtitle?: string;
    /** When true, a "featured" chip is shown next to the title. */
    readonly featured?: boolean;
    /** Label for the featured chip (i18n). */
    readonly featuredLabel?: string;
    /** Navigates to the entity's full view page. */
    readonly onViewFull: () => void;
    /** Navigates to the entity's edit page. */
    readonly onEdit: () => void;
    /**
     * When `true` the underlying Radix Dialog runs in non-modal mode:
     * no scroll-lock, no focus-trap, and no blocking overlay — the list
     * behind the drawer remains fully interactive.
     *
     * Defaults to `false` (standard modal behaviour).
     */
    readonly modal?: boolean;
};

/**
 * Resolves a dot-nested accessor path against an object.
 * e.g. resolveAccessorPath({ destination: { name: 'Foo' } }, 'destination.name') → 'Foo'
 */
function resolveAccessorPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

/**
 * Formats a raw cell value into a displayable string.
 *
 * When an explicit `format` is supplied it takes precedence over auto-inference:
 * - `'date'`    → short localised date via `formatShortDate` (returns `'—'` on null/undefined).
 * - `'boolean'` → boolYes / boolNo strings.
 * - `'list'`    → comma-joined array.
 * - `'text'`    → String() coercion, optionally truncated to `maxLength`.
 * Badge, image, and address are handled directly in JSX (not here).
 * Without an explicit format the original inference rules apply.
 */
function formatValue(
    value: unknown,
    boolYes: string,
    boolNo: string,
    emptyPlaceholder: string,
    format?: 'text' | 'boolean' | 'date' | 'list' | 'badge' | 'image' | 'address',
    maxLength?: number
): string {
    if (value === null || value === undefined || value === '') {
        return emptyPlaceholder;
    }

    // --- Explicit format takes priority ---
    if (format === 'date') {
        const dateVal =
            value instanceof Date
                ? value
                : typeof value === 'string' || typeof value === 'number'
                  ? value
                  : null;
        return formatShortDate({ date: dateVal });
    }

    if (format === 'boolean') {
        if (typeof value === 'boolean') return value ? boolYes : boolNo;
        // Coerce truthy/falsy strings for robustness
        if (value === 'true' || value === 1) return boolYes;
        if (value === 'false' || value === 0) return boolNo;
        return String(value);
    }

    if (format === 'list') {
        if (Array.isArray(value)) {
            if (value.length === 0) return emptyPlaceholder;
            return value.map((item) => (typeof item === 'object' ? '…' : String(item))).join(', ');
        }
        return String(value);
    }

    // --- Auto-inference (format is 'text', omitted, or a rich type handled in JSX) ---
    if (typeof value === 'boolean') {
        return value ? boolYes : boolNo;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return emptyPlaceholder;
        return value.map((item) => (typeof item === 'object' ? '…' : String(item))).join(', ');
    }
    if (typeof value === 'object') {
        // Plain objects are not trivially displayable; skip with em dash
        return emptyPlaceholder;
    }

    const str = String(value);
    if (maxLength !== undefined && str.length > maxLength) {
        return `${str.slice(0, maxLength)}…`;
    }
    return str;
}

/**
 * Resolves a `location` object into a human-readable street address string.
 * Format: `${street} ${number}[, piso ${floor}]`
 */
function resolveAddress(location: unknown, emptyPlaceholder: string): string {
    if (location === null || location === undefined || typeof location !== 'object') {
        return emptyPlaceholder;
    }
    const loc = location as Record<string, unknown>;
    const street = typeof loc.street === 'string' ? loc.street.trim() : '';
    const number = typeof loc.number === 'string' ? loc.number.trim() : '';
    const floor = typeof loc.floor === 'string' ? loc.floor.trim() : '';

    if (!street && !number) return emptyPlaceholder;

    const base = [street, number].filter(Boolean).join(' ');
    return floor ? `${base}, piso ${floor}` : base;
}

/**
 * EntitySummarySheet — a generic "peek" drawer for entity list rows.
 *
 * Renders a Sheet (Radix Dialog sliding from the right) with:
 * - A header showing the entity name as title.
 * - A scrollable body listing each column's label and resolved value.
 * - A footer with "View full page" and "Edit" action buttons.
 *
 * When `modal={false}` the drawer runs in non-modal mode: no scroll-lock,
 * no focus-trap, and the overlay is `pointer-events-none` so the list behind
 * remains fully interactive. Clicking outside closes the drawer UNLESS the
 * click target has `[data-peek-trigger]` ancestry — those clicks switch content
 * via the caller's `onOpenChange` / `setPeekRow` and must not close.
 *
 * Supported `format` values on `SummaryColumn`:
 * - `'text'` / omitted — plain text, optionally truncated via `maxLength`.
 * - `'boolean'` — renders as Sí/No.
 * - `'date'` — short localised date (DD/MM/YYYY).
 * - `'list'` — comma-joined array.
 * - `'badge'` — colored badge using `badgeOptions`.
 * - `'image'` — preview `<img>` from URL resolved via `accessorKey`.
 * - `'address'` — assembles `street number[, piso floor]` from the `location` object.
 *
 * @example
 * ```tsx
 * <EntitySummarySheet
 *   open={peekRow !== null}
 *   onOpenChange={(o) => { if (!o) setPeekRow(null); }}
 *   row={peekRow}
 *   columns={summaryColumns}
 *   title={peekRow?.name ?? ''}
 *   onViewFull={() => { navigate(...); setPeekRow(null); }}
 *   onEdit={() => { navigate(...); setPeekRow(null); }}
 *   modal={false}
 * />
 * ```
 */
export function EntitySummarySheet<TData extends Record<string, unknown>>({
    open,
    onOpenChange,
    row,
    columns,
    title,
    subtitle,
    featured = false,
    featuredLabel,
    onViewFull,
    onEdit,
    modal = false
}: EntitySummarySheetProps<TData>) {
    const { t } = useTranslations();

    const viewFullLabel = t('admin-entities.peek.viewFull' as TranslationKey);
    const editLabel = t('admin-entities.peek.edit' as TranslationKey);
    const summaryLabel = t('admin-entities.peek.summary' as TranslationKey);
    const boolYes = t('admin-entities.peek.booleanYes' as TranslationKey);
    const boolNo = t('admin-entities.peek.booleanNo' as TranslationKey);
    const emptyValue = t('admin-entities.peek.emptyValue' as TranslationKey);

    // Badge fields group into a compact wrap row; date fields pair up in a
    // 2-column grid; everything else renders as stacked label/value rows.
    const badgeFields = columns.filter((col) => col.format === 'badge');
    const dateFields = columns.filter((col) => col.format === 'date');
    const detailFields = columns.filter((col) => col.format !== 'badge' && col.format !== 'date');

    /**
     * `onInteractOutside` / `onPointerDownOutside` handler.
     *
     * If the pointer-down event originates inside a `[data-peek-trigger]` element
     * (or any of its ancestors), we preventDefault() so Radix does NOT close the
     * dialog. The row's own onClick will call setPeekRow() and switch the content.
     *
     * For every other outside interaction we let the default behaviour run,
     * which closes the sheet.
     */
    const handleInteractOutside = (event: {
        target: EventTarget | null;
        preventDefault(): void;
    }) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('[data-peek-trigger]')) {
            event.preventDefault();
        }
    };

    return (
        <Sheet
            open={open}
            onOpenChange={onOpenChange}
            modal={modal}
        >
            <SheetContent
                side="right"
                onInteractOutside={handleInteractOutside}
                onPointerDownOutside={handleInteractOutside}
                /**
                 * In non-modal mode Radix still renders the SheetOverlay inside the
                 * portal. We need it to be non-blocking so clicks pass through to the
                 * list. The overlay is handled inside sheet.tsx via the `modal` prop
                 * forwarded through the data attribute on SheetContent.
                 */
                data-modal={modal ? 'true' : 'false'}
            >
                <SheetHeader>
                    <div className="flex flex-wrap items-center gap-2">
                        <SheetTitle>{title || summaryLabel}</SheetTitle>
                        {featured && featuredLabel ? (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[10px] text-primary uppercase tracking-wide">
                                {featuredLabel}
                            </span>
                        ) : null}
                    </div>
                    <SheetDescription>{subtitle || summaryLabel}</SheetDescription>
                </SheetHeader>

                {/* Scrollable body: a compact badge group, then label/value rows */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {row !== null && row !== undefined ? (
                        <div className="space-y-4">
                            {badgeFields.length > 0 ? (
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                    {badgeFields.map((col) => (
                                        <div
                                            key={col.id}
                                            className="flex flex-col gap-1"
                                        >
                                            <span className="font-bold text-[10px] text-foreground uppercase tracking-wide">
                                                {col.header}
                                            </span>
                                            <BadgeCell
                                                value={resolveAccessorPath(
                                                    row as Record<string, unknown>,
                                                    col.accessorKey
                                                )}
                                                options={col.badgeOptions}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            <dl className="divide-y divide-border">
                                {detailFields.map((col) => {
                                    const raw = resolveAccessorPath(
                                        row as Record<string, unknown>,
                                        col.accessorKey
                                    );

                                    return (
                                        <div
                                            key={col.id}
                                            className="flex flex-col gap-0.5 py-3"
                                        >
                                            <dt className="font-bold text-foreground text-xs uppercase tracking-wide">
                                                {col.header}
                                            </dt>
                                            <dd className="text-foreground text-sm">
                                                {col.format === 'image'
                                                    ? (() => {
                                                          const url =
                                                              typeof raw === 'string' &&
                                                              raw.length > 0
                                                                  ? raw
                                                                  : null;
                                                          return url ? (
                                                              <img
                                                                  src={url}
                                                                  alt={col.header}
                                                                  className="mt-1 max-h-40 w-full rounded-md border border-border object-cover"
                                                                  loading="lazy"
                                                              />
                                                          ) : (
                                                              <span className="text-muted-foreground">
                                                                  {emptyValue}
                                                              </span>
                                                          );
                                                      })()
                                                    : col.format === 'address'
                                                      ? resolveAddress(raw, emptyValue)
                                                      : formatValue(
                                                            raw,
                                                            boolYes,
                                                            boolNo,
                                                            emptyValue,
                                                            col.format,
                                                            col.maxLength
                                                        )}
                                            </dd>
                                        </div>
                                    );
                                })}
                            </dl>

                            {dateFields.length > 0 ? (
                                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-border border-t pt-3">
                                    {dateFields.map((col) => {
                                        const raw = resolveAccessorPath(
                                            row as Record<string, unknown>,
                                            col.accessorKey
                                        );
                                        return (
                                            <div
                                                key={col.id}
                                                className="flex flex-col gap-0.5"
                                            >
                                                <dt className="font-bold text-foreground text-xs uppercase tracking-wide">
                                                    {col.header}
                                                </dt>
                                                <dd className="text-foreground text-sm">
                                                    {formatValue(
                                                        raw,
                                                        boolYes,
                                                        boolNo,
                                                        emptyValue,
                                                        col.format,
                                                        col.maxLength
                                                    )}
                                                </dd>
                                            </div>
                                        );
                                    })}
                                </dl>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <SheetFooter>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onEdit}
                    >
                        {editLabel}
                    </Button>
                    <Button
                        size="sm"
                        onClick={onViewFull}
                    >
                        {viewFullLabel}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
