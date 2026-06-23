/**
 * @file SocialPostContentTab.tsx
 * @description Content tab for the social post detail page (SPEC-254 T-040).
 * Renders caption, final caption, final hashtags, notes, internal notes, and
 * GPT hashtag suggestions with optional promote buttons.
 */

import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';

// ---------------------------------------------------------------------------
// Section helper (used only within this tab)
// ---------------------------------------------------------------------------

interface SectionProps {
    readonly label: string;
    readonly children: React.ReactNode;
}

/**
 * Labeled section container used to group related fields in the content tab.
 */
function Section({ label, children }: SectionProps) {
    return (
        <div>
            <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {label}
            </p>
            {children}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for the SocialPostContentTab component. */
export interface SocialPostContentTabProps {
    readonly post: {
        readonly captionBase: string;
        readonly finalCaption: string | null;
        readonly finalHashtagsText: string | null;
        readonly notes: string | null;
        readonly internalNotes: string | null;
        readonly gptHashtagPayloadJson: string[] | null;
        readonly hashtags: string[];
    };
    readonly canPromote: boolean;
    readonly onPromote: (tag: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Content tab for the social post detail view.
 * Displays all text content fields and GPT hashtag suggestions.
 */
export function SocialPostContentTab({ post, canPromote, onPromote }: SocialPostContentTabProps) {
    const { t } = useTranslations();

    return (
        <div className="space-y-6">
            <Section label={t('social.posts.detail.content.caption')}>
                <p className="whitespace-pre-wrap text-sm">{post.captionBase}</p>
            </Section>

            <Section label={t('social.posts.detail.content.finalCaption')}>
                <p className="whitespace-pre-wrap text-sm">
                    {post.finalCaption ?? t('social.posts.detail.content.finalCaptionEmpty')}
                </p>
            </Section>

            <Section label={t('social.posts.detail.content.finalHashtags')}>
                <p className="text-sm">
                    {post.finalHashtagsText ?? t('social.posts.detail.content.finalHashtagsEmpty')}
                </p>
            </Section>

            <Section label={t('social.posts.detail.content.notes')}>
                <p className="whitespace-pre-wrap text-sm">
                    {post.notes ?? t('social.posts.detail.content.notesEmpty')}
                </p>
            </Section>

            <Section label={t('social.posts.detail.content.internalNotes')}>
                <p className="whitespace-pre-wrap text-sm">
                    {post.internalNotes ?? t('social.posts.detail.content.internalNotesEmpty')}
                </p>
            </Section>

            {/* GPT hashtag suggestions */}
            <Section label={t('social.posts.detail.content.gptHashtags')}>
                {!post.gptHashtagPayloadJson || post.gptHashtagPayloadJson.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        {t('social.posts.detail.content.gptHashtagsEmpty')}
                    </p>
                ) : (
                    <ul className="flex flex-wrap gap-2">
                        {post.gptHashtagPayloadJson.map((tag) => (
                            <li
                                key={tag}
                                className="flex items-center gap-1.5"
                            >
                                <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                                    {tag}
                                </span>
                                {canPromote && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => onPromote(tag)}
                                        data-testid={`promote-btn-${tag}`}
                                    >
                                        {t('social.posts.detail.content.promoteButton')}
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>
        </div>
    );
}
