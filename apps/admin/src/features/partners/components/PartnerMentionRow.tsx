/**
 * PartnerMentionRow — one logged mention, with inline correction (HOS-377 T-023).
 *
 * ## Why a row can be corrected at all
 *
 * These rows are typed in by a human at the moment they perform the action, so
 * a wrong date or a link pasted from the wrong tab is a matter of when, not if.
 * That is the whole reason `partner_mentions` is editable while
 * `social_publish_logs` is not: one records a person, the other records a
 * machine, and machines do not mistype.
 *
 * ## Why the channel is editable here
 *
 * "This was Facebook, not Instagram" is a real correction, and switching the
 * channel usually means the stored link is wrong too — it points at the network
 * being corrected away from. The update schema enforces that coupling (a switch
 * to a permalink channel must carry the URL in the same patch) and the service
 * re-validates the MERGED row, which catches the mirror case this form cannot
 * express. So this is a convenience, not the gate.
 *
 * `internalNote` is shown collapsed and labelled as internal. It is the one
 * field on this surface that must never be repeated back to a partner, and an
 * admin copy-pasting a row into an email is the realistic way it would leak.
 */

import { ExternalLinkIcon } from '@repo/icons';
import { type PartnerMention, PartnerMentionChannelEnum } from '@repo/schemas';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdatePartnerMentionMutation } from '@/features/partners/hooks/usePartnerMentions';
import { useTranslations } from '@/hooks/use-translations';

/** Longest internal note rendered before it collapses behind a toggle. */
const NOTE_PREVIEW_LENGTH = 120;

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

export interface PartnerMentionRowProps {
    readonly partnerId: string;
    readonly mention: PartnerMention;
    readonly onRemove: (mentionId: string) => void;
    readonly isRemoving?: boolean;
}

export function PartnerMentionRow({
    partnerId,
    mention,
    onRemove,
    isRemoving = false
}: PartnerMentionRowProps) {
    const { t } = useTranslations();
    const updateMutation = useUpdatePartnerMentionMutation(partnerId);

    const [isEditing, setIsEditing] = React.useState(false);
    const [noteExpanded, setNoteExpanded] = React.useState(false);
    const [channel, setChannel] = React.useState<PartnerMentionChannelEnum>(
        mention.channel as PartnerMentionChannelEnum
    );
    const [url, setUrl] = React.useState(mention.url ?? '');
    const [internalNote, setInternalNote] = React.useState(mention.internalNote ?? '');
    const [error, setError] = React.useState<string | null>(null);

    const handleSave = async () => {
        setError(null);
        try {
            await updateMutation.mutateAsync({
                mentionId: mention.id,
                payload: {
                    channel,
                    url: url.trim() ? url.trim() : null,
                    internalNote: internalNote.trim() ? internalNote.trim() : null
                }
            });
            setIsEditing(false);
        } catch {
            setError(t('admin-pages.partnerMentions.errors.updateFailed'));
        }
    };

    if (isEditing) {
        return (
            <li className="space-y-2 rounded-md border p-3">
                <div className="space-y-1">
                    <Label htmlFor={`edit-channel-${mention.id}`}>
                        {t('admin-pages.partnerMentions.fields.channel')}
                    </Label>
                    <select
                        id={`edit-channel-${mention.id}`}
                        className="w-full rounded-md border px-3 py-2"
                        value={channel}
                        onChange={(event) =>
                            setChannel(event.target.value as PartnerMentionChannelEnum)
                        }
                    >
                        {CHANNEL_ORDER.map((option) => (
                            <option
                                key={option}
                                value={option}
                            >
                                {t(`admin-pages.partnerMentions.channels.${option}`)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <Label htmlFor={`edit-url-${mention.id}`}>
                        {t('admin-pages.partnerMentions.fields.url')}
                    </Label>
                    <Input
                        id={`edit-url-${mention.id}`}
                        type="url"
                        value={url}
                        placeholder={t('admin-pages.partnerMentions.fields.urlPlaceholder')}
                        onChange={(event) => setUrl(event.target.value)}
                    />
                </div>

                <div className="space-y-1">
                    <Label htmlFor={`edit-note-${mention.id}`}>
                        {t('admin-pages.partnerMentions.fields.internalNote')}
                    </Label>
                    <Textarea
                        id={`edit-note-${mention.id}`}
                        value={internalNote}
                        onChange={(event) => setInternalNote(event.target.value)}
                    />
                </div>

                {error ? <p className="text-destructive text-sm">{error}</p> : null}

                <div className="flex gap-2">
                    <Button
                        type="button"
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={handleSave}
                    >
                        {updateMutation.isPending
                            ? t('admin-pages.partnerMentions.actions.saving')
                            : t('admin-pages.partnerMentions.actions.save')}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                    >
                        {t('admin-pages.partnerMentions.form.cancel')}
                    </Button>
                </div>
            </li>
        );
    }

    const note = mention.internalNote ?? '';
    const noteIsLong = note.length > NOTE_PREVIEW_LENGTH;

    return (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-medium">
                {t(`admin-pages.partnerMentions.channels.${mention.channel}`)}
            </span>

            {mention.url ? (
                <a
                    href={mention.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 underline"
                >
                    {t('admin-pages.partnerMentions.actions.viewPublication')}
                    <ExternalLinkIcon
                        className="h-3 w-3"
                        aria-hidden="true"
                    />
                </a>
            ) : (
                // A channel with no public permalink renders as plain text. An
                // anchor pointing nowhere is worse than no anchor on a surface
                // whose promise is that the link can be followed.
                <span className="text-muted-foreground">
                    {t('admin-pages.partnerMentions.actions.noPublicationLink')}
                </span>
            )}

            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
            >
                {t('admin-pages.partnerMentions.actions.edit')}
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isRemoving}
                onClick={() => onRemove(mention.id)}
            >
                {t('admin-pages.partnerMentions.actions.remove')}
            </Button>

            {note ? (
                <span className="w-full text-muted-foreground text-xs">
                    {t('admin-pages.partnerMentions.fields.internalNote')}:{' '}
                    {noteIsLong && !noteExpanded ? `${note.slice(0, NOTE_PREVIEW_LENGTH)}…` : note}
                    {noteIsLong ? (
                        <button
                            type="button"
                            className="ml-1 underline"
                            onClick={() => setNoteExpanded((current) => !current)}
                        >
                            {noteExpanded ? '−' : '+'}
                        </button>
                    ) : null}
                </span>
            ) : null}
        </li>
    );
}
