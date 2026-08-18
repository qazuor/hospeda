/**
 * PartnerMentionsSection — the admin view of one partner's mentions log (HOS-377 T-023).
 *
 * Groups rows by `batchId` the same way the partner-facing view does, so the
 * admin sees what the partner sees: a campaign that ran on four networks is ONE
 * entry with four links, not four entries sharing a date. An admin looking at a
 * flat list would have no way to tell which rows went out together, which is
 * exactly the question they ask when a partner writes in.
 *
 * The one thing this surface has that the partner's does not is `internalNote`,
 * and it is labelled as internal on every row it appears. That labelling is not
 * decoration: the note is the only field here that must never be repeated back
 * to a partner, and an admin copy-pasting a "mention log" into an email is the
 * realistic way it would leak.
 *
 * AC-3 governs every string: this is a record of ACTIONS, never a performance
 * report. All copy comes from `admin-pages.partnerMentions.*`, which the T-030
 * static guard scans.
 */

import type { PartnerMention } from '@repo/schemas';
import { formatCalendarDate } from '@repo/utils';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { PartnerMentionForm } from '@/features/partners/components/PartnerMentionForm';
import { PartnerMentionRow } from '@/features/partners/components/PartnerMentionRow';
import {
    useDeletePartnerMentionMutation,
    usePartnerMentionsQuery
} from '@/features/partners/hooks/usePartnerMentions';
import { useTranslations } from '@/hooks/use-translations';

export interface PartnerMentionsSectionProps {
    readonly partnerId: string;
}

/** Long-form day, matching what the partner-facing log shows. */
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
};

interface MentionBatch {
    readonly key: string;
    readonly batchId: string | null;
    readonly mentionedAt: Date;
    readonly mentions: PartnerMention[];
}

/**
 * Collapses a flat, newest-first list into batches.
 *
 * Mirrors `groupMentionsIntoBatches` in `@repo/service-core`, which does the
 * same for the partner-facing payload. Duplicated deliberately rather than
 * shared: the service groups already-stripped public rows, this groups admin
 * rows that still carry `internalNote`, and sharing one function would mean one
 * of the two surfaces receiving the wrong shape.
 *
 * An un-batched mention (`batchId === null`) becomes its own single-item batch,
 * so there is exactly one thing to render rather than two.
 */
function groupByBatch(mentions: readonly PartnerMention[]): MentionBatch[] {
    const batches: MentionBatch[] = [];
    const byBatchId = new Map<string, MentionBatch>();

    for (const mention of mentions) {
        const mentionedAt = new Date(mention.mentionedAt);

        if (!mention.batchId) {
            batches.push({
                key: mention.id,
                batchId: null,
                mentionedAt,
                mentions: [mention]
            });
            continue;
        }

        const existing = byBatchId.get(mention.batchId);
        if (existing) {
            existing.mentions.push(mention);
            continue;
        }

        const created: MentionBatch = {
            key: mention.batchId,
            batchId: mention.batchId,
            mentionedAt,
            mentions: [mention]
        };
        byBatchId.set(mention.batchId, created);
        batches.push(created);
    }

    return batches;
}

/**
 * Renders the BROADCAST DATE — a calendar day, not an instant.
 *
 * `mentionedAt` is a `timestamptz`, but nothing about it carries a time of day:
 * the form offers a bare date picker, which pins the value to midnight UTC.
 * Rendering that in the reader's own timezone showed every mention registered
 * through the UI one day early (smoke agosto 2026, H-73), and because the log
 * groups by day, a broadcast could even land under the wrong heading next to
 * another campaign.
 *
 * H-84 is why this reads "calendar date" and not "date column": the column type
 * was never what decided it.
 */
function formatMentionedAt(value: Date): string {
    return formatCalendarDate({ value, locale: 'es-AR', options: DATE_FORMAT }) ?? '—';
}

export function PartnerMentionsSection({ partnerId }: PartnerMentionsSectionProps) {
    const { t } = useTranslations();
    const query = usePartnerMentionsQuery(partnerId);
    const deleteMutation = useDeletePartnerMentionMutation(partnerId);

    const [showForm, setShowForm] = React.useState(false);
    const [actionError, setActionError] = React.useState<string | null>(null);

    const batches = React.useMemo(() => groupByBatch(query.data?.items ?? []), [query.data]);

    const handleRemove = async (mentionId: string) => {
        setActionError(null);
        try {
            await deleteMutation.mutateAsync(mentionId);
        } catch {
            setActionError(t('admin-pages.partnerMentions.errors.removeFailed'));
        }
    };

    return (
        <section className="space-y-4 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="font-medium text-lg">
                        {t('admin-pages.partnerMentions.title')}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {t('admin-pages.partnerMentions.description')}
                    </p>
                </div>
                <Button
                    type="button"
                    onClick={() => setShowForm((current) => !current)}
                >
                    {showForm
                        ? t('admin-pages.partnerMentions.form.cancel')
                        : t('admin-pages.partnerMentions.actions.add')}
                </Button>
            </div>

            {showForm ? (
                <PartnerMentionForm
                    partnerId={partnerId}
                    onSubmitted={() => setShowForm(false)}
                    onCancel={() => setShowForm(false)}
                />
            ) : null}

            {actionError ? <p className="text-destructive text-sm">{actionError}</p> : null}

            {query.isLoading ? (
                <p className="text-muted-foreground text-sm">
                    {t('admin-pages.partnerMentions.loading')}
                </p>
            ) : null}

            {query.isError ? (
                <p className="text-destructive text-sm">
                    {t('admin-pages.partnerMentions.errors.loadFailed')}
                </p>
            ) : null}

            {!query.isLoading && !query.isError && batches.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    {t('admin-pages.partnerMentions.empty')}
                </p>
            ) : null}

            <ul className="space-y-3">
                {batches.map((batch) => (
                    <li
                        key={batch.key}
                        className="rounded-md border p-3"
                    >
                        <p className="font-medium">{formatMentionedAt(batch.mentionedAt)}</p>
                        <ul className="mt-2 space-y-2">
                            {batch.mentions.map((mention) => (
                                <PartnerMentionRow
                                    key={mention.id}
                                    partnerId={partnerId}
                                    mention={mention}
                                    onRemove={handleRemove}
                                    isRemoving={deleteMutation.isPending}
                                />
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
        </section>
    );
}
