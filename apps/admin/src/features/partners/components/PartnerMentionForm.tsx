/**
 * PartnerMentionForm — log one promotion across N channels (HOS-377 T-024, AC-7).
 *
 * ## Why N channels is ONE form and ONE request
 *
 * A campaign usually runs on several networks at once. Selecting four channels
 * reveals four URL inputs and submits a SINGLE request, which the server turns
 * into four rows sharing one generated `batchId` and exactly one email to the
 * partner. Submitting them one at a time would produce four ungrouped entries
 * in the partner's log and four emails about one campaign.
 *
 * That is why this component holds a `Map` of channel → url rather than a
 * single channel field with an "add another" button: the batch is the unit of
 * work, so it has to be the unit of the form too.
 *
 * ## Why the URL rule is per channel
 *
 * Instagram, Facebook, Twitter, YouTube, TikTok and the newsletter all produce
 * a public permalink and the link is the whole promise of the log — the partner
 * clicks through and verifies. A WhatsApp broadcast and "other" have no public
 * URL, so requiring one there would force admins to invent a link. The rule
 * lives in `requiresMentionUrl` in `@repo/schemas`, consumed here rather than
 * restated, and the server re-checks it: this is a convenience, not the gate.
 *
 * Uses plain state + `safeParse` at submit, matching the sibling relation
 * managers in this app (`FaqManager`, `PoiDestinationRelationManager`).
 */

import {
    createPartnerMentionBatchSchema,
    PartnerMentionChannelEnum,
    requiresMentionUrl
} from '@repo/schemas';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreatePartnerMentionsMutation } from '@/features/partners/hooks/usePartnerMentions';
import { useTranslations } from '@/hooks/use-translations';

/** Canonical order — the same sequence the partner-facing log and the email use. */
const CHANNEL_ORDER: readonly PartnerMentionChannelEnum[] = [
    PartnerMentionChannelEnum.INSTAGRAM,
    PartnerMentionChannelEnum.FACEBOOK,
    PartnerMentionChannelEnum.TWITTER,
    PartnerMentionChannelEnum.YOUTUBE,
    PartnerMentionChannelEnum.TIKTOK,
    PartnerMentionChannelEnum.NEWSLETTER,
    PartnerMentionChannelEnum.WHATSAPP,
    PartnerMentionChannelEnum.OTHER
];

export interface PartnerMentionFormProps {
    readonly partnerId: string;
    /** Called after a successful submission, so the parent can close the form. */
    readonly onSubmitted?: (created: number) => void;
    readonly onCancel?: () => void;
}

/** Today in `yyyy-mm-dd`, for the date input's default. */
function todayInputValue(): string {
    return new Date().toISOString().slice(0, 10);
}

export function PartnerMentionForm({ partnerId, onSubmitted, onCancel }: PartnerMentionFormProps) {
    const { t } = useTranslations();
    const createMutation = useCreatePartnerMentionsMutation(partnerId);

    const [mentionedAt, setMentionedAt] = React.useState(todayInputValue);
    const [internalNote, setInternalNote] = React.useState('');
    /** Selected channels, each with its own URL. The Map IS the batch. */
    const [urlByChannel, setUrlByChannel] = React.useState<Map<PartnerMentionChannelEnum, string>>(
        () => new Map()
    );
    const [errorByChannel, setErrorByChannel] = React.useState<
        Partial<Record<PartnerMentionChannelEnum, string>>
    >({});
    const [formError, setFormError] = React.useState<string | null>(null);

    const toggleChannel = (channel: PartnerMentionChannelEnum) => {
        setUrlByChannel((current) => {
            const next = new Map(current);
            if (next.has(channel)) {
                next.delete(channel);
            } else {
                next.set(channel, '');
            }
            return next;
        });
        // Deselecting a channel must take its error with it, or the form stays
        // un-submittable because of a field that is no longer on screen.
        setErrorByChannel((current) => {
            const { [channel]: _removed, ...rest } = current;
            return rest;
        });
    };

    const setChannelUrl = (channel: PartnerMentionChannelEnum, url: string) => {
        setUrlByChannel((current) => new Map(current).set(channel, url));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setFormError(null);
        setErrorByChannel({});

        const selected = CHANNEL_ORDER.filter((channel) => urlByChannel.has(channel));
        if (selected.length === 0) {
            setFormError(t('admin-pages.partnerMentions.form.selectChannels'));
            return;
        }

        const entries = selected.map((channel) => {
            const url = urlByChannel.get(channel)?.trim();
            return { channel, url: url ? url : undefined };
        });

        const parsed = createPartnerMentionBatchSchema.safeParse({
            mentionedAt: new Date(mentionedAt),
            internalNote: internalNote.trim() ? internalNote.trim() : undefined,
            entries
        });

        if (!parsed.success) {
            // The per-entry URL rule reports on the `['url']` path of its own
            // entry, so the issue index maps back to the channel that failed —
            // which is what lets the message land on the offending input rather
            // than at the top of a form with four URL fields on it.
            const perChannel: Partial<Record<PartnerMentionChannelEnum, string>> = {};
            for (const issue of parsed.error.issues) {
                const [root, index] = issue.path;
                if (root === 'entries' && typeof index === 'number') {
                    const channel = selected[index];
                    if (channel) {
                        perChannel[channel] = t('admin-pages.partnerMentions.form.urlRequired');
                    }
                }
            }
            setErrorByChannel(perChannel);
            if (Object.keys(perChannel).length === 0) {
                setFormError(t('admin-pages.partnerMentions.errors.createFailed'));
            }
            return;
        }

        try {
            // ONE request for every selected channel (AC-7).
            const created = await createMutation.mutateAsync(parsed.data);
            setUrlByChannel(new Map());
            setInternalNote('');
            onSubmitted?.(created.length);
        } catch {
            setFormError(t('admin-pages.partnerMentions.errors.createFailed'));
        }
    };

    const selectedChannels = CHANNEL_ORDER.filter((channel) => urlByChannel.has(channel));

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-lg border p-4"
        >
            <div>
                <h3 className="font-medium text-lg">
                    {t('admin-pages.partnerMentions.form.title')}
                </h3>
                <p className="text-muted-foreground text-sm">
                    {t('admin-pages.partnerMentions.form.description')}
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="mention-date">
                    {t('admin-pages.partnerMentions.fields.mentionedAt')}
                </Label>
                <Input
                    id="mention-date"
                    type="date"
                    value={mentionedAt}
                    onChange={(event) => setMentionedAt(event.target.value)}
                    required
                />
            </div>

            <fieldset className="space-y-2">
                <legend className="font-medium text-sm">
                    {t('admin-pages.partnerMentions.fields.channels')}
                </legend>
                <div className="flex flex-wrap gap-2">
                    {CHANNEL_ORDER.map((channel) => {
                        const isSelected = urlByChannel.has(channel);
                        return (
                            <button
                                key={channel}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => toggleChannel(channel)}
                                className={
                                    isSelected
                                        ? 'rounded-full bg-primary px-3 py-1 text-primary-foreground text-sm'
                                        : 'rounded-full border px-3 py-1 text-sm'
                                }
                            >
                                {t(`admin-pages.partnerMentions.channels.${channel}`)}
                            </button>
                        );
                    })}
                </div>
            </fieldset>

            {/* One URL input per SELECTED channel — the array of channels and the
                array of links stay paired by construction. */}
            {selectedChannels.map((channel) => {
                const needsUrl = requiresMentionUrl({ channel });
                const error = errorByChannel[channel];
                return (
                    <div
                        key={channel}
                        className="space-y-1"
                    >
                        <Label htmlFor={`mention-url-${channel}`}>
                            {t(`admin-pages.partnerMentions.channels.${channel}`)} —{' '}
                            {t('admin-pages.partnerMentions.fields.url')}
                        </Label>
                        <Input
                            id={`mention-url-${channel}`}
                            type="url"
                            inputMode="url"
                            placeholder={t('admin-pages.partnerMentions.fields.urlPlaceholder')}
                            value={urlByChannel.get(channel) ?? ''}
                            onChange={(event) => setChannelUrl(channel, event.target.value)}
                            aria-invalid={Boolean(error)}
                            aria-describedby={`mention-url-help-${channel}`}
                        />
                        <p
                            id={`mention-url-help-${channel}`}
                            className={
                                error ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'
                            }
                        >
                            {error ??
                                (needsUrl
                                    ? t('admin-pages.partnerMentions.form.urlRequired')
                                    : t('admin-pages.partnerMentions.form.urlOptional'))}
                        </p>
                    </div>
                );
            })}

            <div className="space-y-1">
                <Label htmlFor="mention-note">
                    {t('admin-pages.partnerMentions.fields.internalNote')}
                </Label>
                <Textarea
                    id="mention-note"
                    value={internalNote}
                    placeholder={t('admin-pages.partnerMentions.fields.internalNotePlaceholder')}
                    onChange={(event) => setInternalNote(event.target.value)}
                    aria-describedby="mention-note-help"
                />
                <p
                    id="mention-note-help"
                    className="text-muted-foreground text-sm"
                >
                    {t('admin-pages.partnerMentions.fields.internalNoteHelp')}
                </p>
            </div>

            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

            <div className="flex gap-2">
                <Button
                    type="submit"
                    disabled={createMutation.isPending}
                >
                    {createMutation.isPending
                        ? t('admin-pages.partnerMentions.form.submitting')
                        : t('admin-pages.partnerMentions.form.submit')}
                </Button>
                {onCancel ? (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                    >
                        {t('admin-pages.partnerMentions.form.cancel')}
                    </Button>
                ) : null}
            </div>
        </form>
    );
}
