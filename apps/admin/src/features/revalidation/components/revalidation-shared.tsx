/**
 * Shared UI primitives for the Revalidation management page.
 *
 * @module routes/_authed/revalidation/components/revalidation-shared
 */

import { LoaderIcon } from '@repo/icons';
import type { RevalidationResponse } from '@repo/schemas';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from '@/hooks/use-translations';

// ---------------------------------------------------------------------------
// InlineNumberField
// ---------------------------------------------------------------------------

type InlineNumberFieldProps = {
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly onSave: (value: number) => void;
    /** Accessible label describing what this field controls */
    readonly 'aria-label'?: string;
};

/**
 * Click-to-edit numeric field.
 *
 * Displays the number as plain text. Clicking opens an `<input type="number">`
 * that commits on blur or Enter, and cancels on Escape.
 */
export function InlineNumberField({
    value,
    min,
    max,
    onSave,
    'aria-label': ariaLabel
}: InlineNumberFieldProps) {
    const { t } = useTranslations();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(value));

    const commit = () => {
        const parsed = Number.parseInt(draft, 10);
        if (!Number.isNaN(parsed) && parsed >= min && parsed <= max) {
            onSave(parsed);
        }
        setEditing(false);
    };

    if (editing) {
        return (
            <output>
                <input
                    type="number"
                    className="w-20 rounded border px-2 py-1 text-right text-sm"
                    value={draft}
                    min={min}
                    max={max}
                    aria-label={ariaLabel}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                />
            </output>
        );
    }

    return (
        <button
            type="button"
            className="rounded px-2 py-1 text-right text-sm hover:bg-muted"
            title={t('revalidation.inline.clickToEdit')}
            aria-label={ariaLabel ? `${ariaLabel}: ${value}` : undefined}
            onClick={() => {
                setDraft(String(value));
                setEditing(true);
            }}
        >
            {value}
        </button>
    );
}

// ---------------------------------------------------------------------------
// State placeholders
// ---------------------------------------------------------------------------

/** Full-page loading spinner with a caption. */
export function LoadingState({ message }: { readonly message: string }) {
    return (
        <div className="py-12 text-center">
            <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground text-sm">{message}</p>
        </div>
    );
}

/** Error state with a hint to check the API. */
export function ErrorState({ message }: { readonly message: string }) {
    const { t } = useTranslations();
    return (
        <div className="py-12 text-center">
            <p className="text-destructive text-sm">{message}</p>
            <p className="mt-2 text-muted-foreground text-xs">{t('revalidation.errorHint')}</p>
        </div>
    );
}

/** Empty data state. */
export function EmptyState({ message }: { readonly message: string }) {
    return (
        <div className="py-12 text-center">
            <p className="text-muted-foreground text-sm">{message}</p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

type StatCardProps = {
    readonly label: string;
    readonly value: number;
    readonly suffix?: string;
};

/** Metric display card used in the stats row. */
export function StatCard({ label, value, suffix }: StatCardProps) {
    return (
        <Card>
            <CardContent className="pt-6">
                <p className="text-muted-foreground text-sm">{label}</p>
                <p className="mt-1 font-bold text-3xl">
                    {value.toLocaleString()}
                    {suffix ?? ''}
                </p>
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// ManualForm
// ---------------------------------------------------------------------------

type ManualFormProps = {
    readonly tagsInput: string;
    readonly reason: string;
    readonly isPending: boolean;
    readonly parsedCount: number;
    /** Whether the destructive "purge entire zone" mode is active. Defaults off. */
    readonly purgeEverything: boolean;
    readonly onTagsChange: (value: string) => void;
    readonly onReasonChange: (value: string) => void;
    readonly onPurgeEverythingChange: (value: boolean) => void;
    readonly onSubmit: (e: React.FormEvent) => void;
};

/**
 * Form to enter comma-separated cache tags and an optional audit reason, plus
 * an explicit, visually distinct opt-in for a whole-zone purge.
 *
 * The whole-zone toggle is OFF by default (`purgeEverything`) — reaching the
 * destructive path always requires the operator to deliberately flip it, per
 * the same "never the implicit fallback" contract the manual-revalidate
 * endpoint enforces server-side.
 */
export function ManualForm({
    tagsInput,
    reason,
    isPending,
    parsedCount,
    purgeEverything,
    onTagsChange,
    onReasonChange,
    onPurgeEverythingChange,
    onSubmit
}: ManualFormProps) {
    const { t, tPlural } = useTranslations();
    return (
        <form
            onSubmit={onSubmit}
            className="space-y-4"
        >
            <div>
                <label
                    htmlFor="revalidation-tags"
                    className="mb-2 block font-medium text-sm"
                >
                    {t('revalidation.manual.tagsLabel')}
                </label>
                <textarea
                    id="revalidation-tags"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder={t('revalidation.manual.tagsPlaceholder')}
                    value={tagsInput}
                    onChange={(e) => onTagsChange(e.target.value)}
                    disabled={isPending || purgeEverything}
                />
                <p className="mt-1 text-muted-foreground text-xs">
                    {t('revalidation.manual.tagsHint')}
                </p>
            </div>
            <div>
                <label
                    htmlFor="revalidation-reason"
                    className="mb-2 block font-medium text-sm"
                >
                    {t('revalidation.manual.reasonLabel')}
                </label>
                <Input
                    id="revalidation-reason"
                    placeholder={t('revalidation.manual.reasonPlaceholder')}
                    value={reason}
                    onChange={(e) => onReasonChange(e.target.value)}
                    disabled={isPending}
                />
            </div>

            {/* Whole-zone purge opt-in — deliberately styled as destructive and
                kept visually separate from the tags form above it. */}
            <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <Switch
                    id="revalidation-purge-everything"
                    checked={purgeEverything}
                    onCheckedChange={onPurgeEverythingChange}
                    disabled={isPending}
                    aria-label={t('revalidation.manual.purgeEverythingLabel')}
                />
                <div className="space-y-1">
                    <label
                        htmlFor="revalidation-purge-everything"
                        className="block font-medium text-destructive text-sm"
                    >
                        {t('revalidation.manual.purgeEverythingLabel')}
                    </label>
                    <p className="text-muted-foreground text-xs">
                        {t('revalidation.manual.purgeEverythingWarning')}
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">
                    {purgeEverything
                        ? ''
                        : tPlural('revalidation.manual.tagsCount', parsedCount, {
                              count: parsedCount
                          })}
                </p>
                <Button
                    type="submit"
                    variant={purgeEverything ? 'destructive' : 'default'}
                    disabled={isPending || (!purgeEverything && parsedCount === 0)}
                >
                    {isPending ? (
                        <>
                            <LoaderIcon className="mr-2 size-4 animate-spin" />
                            {t('revalidation.manual.submittingButton')}
                        </>
                    ) : purgeEverything ? (
                        t('revalidation.manual.purgeEverythingButton')
                    ) : (
                        t('revalidation.manual.submitButton')
                    )}
                </Button>
            </div>
        </form>
    );
}

// ---------------------------------------------------------------------------
// RevalidationResultTable
// ---------------------------------------------------------------------------

type RevalidationResultTableProps = {
    readonly result: RevalidationResponse;
};

/**
 * Displays the per-target result of a completed revalidation request. A
 * target is a cache tag, or `*` for a whole-zone purge.
 */
export function RevalidationResultTable({ result }: RevalidationResultTableProps) {
    const { t } = useTranslations();
    const succeeded = result.revalidated.length;
    const failed = result.failed.length;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('revalidation.result.cardTitle')}</CardTitle>
                <CardDescription>
                    {t('revalidation.result.cardDescription', {
                        succeeded,
                        succeededSuffix: succeeded === 1 ? '' : 's',
                        failed,
                        failedSuffix: failed === 1 ? '' : 's',
                        duration: result.duration
                    })}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="px-4 py-2 text-left font-medium">
                                    {t('revalidation.result.tagHeader')}
                                </th>
                                <th className="px-4 py-2 text-center font-medium">
                                    {t('revalidation.result.statusHeader')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.revalidated.map((target) => (
                                <tr
                                    key={`ok-${target}`}
                                    className="border-b hover:bg-muted/50"
                                >
                                    <td className="px-4 py-2 font-mono text-xs">{target}</td>
                                    <td className="px-4 py-2 text-center">
                                        <Badge variant="default">OK</Badge>
                                    </td>
                                </tr>
                            ))}
                            {result.failed.map((target) => (
                                <tr
                                    key={`fail-${target}`}
                                    className="border-b hover:bg-muted/50"
                                >
                                    <td className="px-4 py-2 font-mono text-xs">{target}</td>
                                    <td className="px-4 py-2 text-center">
                                        <Badge variant="destructive">
                                            {t('revalidation.status.failed')}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
