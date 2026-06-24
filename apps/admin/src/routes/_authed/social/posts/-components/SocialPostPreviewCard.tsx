/**
 * @file SocialPostPreviewCard.tsx
 * @description Social-post visual preview card for the detail page (SPEC-254 T-040).
 *
 * Simulates how the post would look when published: primary image (or placeholder),
 * the effective caption (finalCaption ?? captionBase), and the effective hashtags
 * (finalHashtagsText ?? hashtags joined). For multiple media items renders a
 * simple horizontal gallery with first-image promoted as hero.
 */

import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single media item as returned by the detail DTO. */
interface MediaItem {
    readonly cloudinaryUrl: string | null | undefined;
    readonly position: number;
    // biome-ignore lint/suspicious/noExplicitAny: DTO is typed loosely from service-core
    readonly [key: string]: any;
}

/** Props for {@link SocialPostPreviewCard}. */
export interface SocialPostPreviewCardProps {
    /** Media items attached to the post. */
    readonly media: ReadonlyArray<Record<string, unknown>>;
    /** Base caption (always present). */
    readonly captionBase: string;
    /** Curated final caption; takes precedence over captionBase when present. */
    readonly finalCaption: string | null;
    /** Pre-formatted final hashtags string; takes precedence over hashtags array. */
    readonly finalHashtagsText: string | null;
    /** Raw hashtag strings from the DTO. */
    readonly hashtags: readonly string[];
    /** Whether the current user can promote GPT hashtags to the catalog. */
    readonly canPromote: boolean;
    /** GPT-suggested hashtags for the promote workflow. */
    readonly gptHashtagPayloadJson: readonly string[] | null;
    /** Callback to open the promote-hashtag modal. */
    readonly onPromote: (tag: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the stable key for a media item using assetId + position when available,
 * falling back to the array index.
 */
function mediaKey(item: Record<string, unknown>, idx: number): string {
    const assetId = item.assetId as string | null | undefined;
    const position = item.position as number | null | undefined;
    if (assetId && position != null) return `media-${assetId}-${position}`;
    return `media-idx-${idx}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Placeholder shown when no cloudinaryUrl is available for a media item. */
function MediaPlaceholder({ label }: { readonly label: string }) {
    return (
        <div className="flex aspect-square w-full items-center justify-center rounded-lg border bg-muted text-muted-foreground text-sm">
            {label}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Visual preview card that simulates how a social post would look when published.
 * Shows the hero image, effective caption, and effective hashtags together in one block.
 * When multiple media items exist, additional ones appear as a thumbnail row below the hero.
 *
 * @param props - {@link SocialPostPreviewCardProps}
 */
export function SocialPostPreviewCard({
    media,
    captionBase,
    finalCaption,
    finalHashtagsText,
    hashtags,
    canPromote,
    gptHashtagPayloadJson,
    onPromote
}: SocialPostPreviewCardProps) {
    const { t } = useTranslations();

    const effectiveCaption = finalCaption ?? captionBase;
    const effectiveHashtags =
        finalHashtagsText ??
        (hashtags.length > 0
            ? hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
            : null);

    // Sort media by position ascending for display order.
    const sortedMedia = [...media].sort((a, b) => (a.position as number) - (b.position as number));

    const heroItem = sortedMedia[0] as MediaItem | undefined;
    const heroUrl = heroItem?.cloudinaryUrl ?? null;
    const extraItems = sortedMedia.slice(1) as MediaItem[];

    return (
        <div
            className="overflow-hidden rounded-xl border bg-card shadow-sm"
            data-testid="post-preview-card"
        >
            {/* Hero image */}
            <div className="relative w-full">
                {heroUrl ? (
                    <img
                        src={heroUrl}
                        alt={t('social.posts.detail.preview.imageAlt')}
                        className="max-h-[420px] w-full bg-muted object-contain"
                    />
                ) : (
                    <div className="flex h-56 items-center justify-center bg-muted text-muted-foreground text-sm">
                        {t('social.posts.detail.preview.noImage')}
                    </div>
                )}
            </div>

            {/* Thumbnail gallery (additional media) */}
            {extraItems.length > 0 && (
                <div
                    className="flex gap-2 overflow-x-auto p-3"
                    aria-label="Additional media"
                >
                    {extraItems.map((item, idx) => {
                        const url = item.cloudinaryUrl ?? null;
                        return (
                            <div
                                key={mediaKey(item as Record<string, unknown>, idx + 1)}
                                className="h-20 w-20 shrink-0"
                            >
                                {url ? (
                                    <img
                                        src={url}
                                        alt={t('social.posts.detail.preview.imageAlt')}
                                        className="h-full w-full rounded-md border object-cover"
                                    />
                                ) : (
                                    <MediaPlaceholder
                                        label={t('social.posts.detail.media.pendingUpload')}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Caption + hashtags */}
            <div className="space-y-3 p-4">
                {/* Caption */}
                <p
                    className="whitespace-pre-wrap text-sm leading-relaxed"
                    data-testid="post-preview-caption"
                >
                    {effectiveCaption || (
                        <span className="text-muted-foreground italic">
                            {t('social.posts.detail.preview.noCaption')}
                        </span>
                    )}
                </p>

                {/* Hashtags */}
                {effectiveHashtags ? (
                    <p
                        className="text-primary/80 text-sm"
                        data-testid="post-preview-hashtags"
                    >
                        {effectiveHashtags}
                    </p>
                ) : (
                    <p className="text-muted-foreground text-sm italic">
                        {t('social.posts.detail.preview.noHashtags')}
                    </p>
                )}

                {/* GPT hashtag promote section */}
                {canPromote && gptHashtagPayloadJson && gptHashtagPayloadJson.length > 0 && (
                    <div className="border-t pt-3">
                        <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                            {t('social.posts.detail.detailsTab.hashtagsLabel')}
                        </p>
                        <ul className="flex flex-wrap gap-2">
                            {gptHashtagPayloadJson.map((tag) => (
                                <li
                                    key={tag}
                                    className="flex items-center gap-1"
                                >
                                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                                        {tag}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => onPromote(tag)}
                                        data-testid={`promote-btn-${tag}`}
                                    >
                                        {t('social.posts.detail.content.promoteButton')}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
