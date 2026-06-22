/**
 * @file SocialPostMediaTab.tsx
 * @description Media tab for the social post detail page (SPEC-254 T-040).
 * Renders a grid of media assets with stable keys derived from assetId + position.
 */

import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for the SocialPostMediaTab component. */
export interface SocialPostMediaTabProps {
    readonly media: ReadonlyArray<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Media tab for the social post detail view.
 * Renders a responsive image grid or an empty state message.
 */
export function SocialPostMediaTab({ media }: SocialPostMediaTabProps) {
    const { t } = useTranslations();

    if (media.length === 0) {
        return (
            <p
                className="text-muted-foreground text-sm"
                data-testid="media-empty"
            >
                {t('social.posts.detail.media.empty' as TranslationKey)}
            </p>
        );
    }

    const STABLE_MEDIA_KEYS = media.map((m) => `media-${String(m.assetId)}-${String(m.position)}`);

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {media.map((item, idx) => {
                const cloudinaryUrl = item.cloudinaryUrl as string | null | undefined;
                const pos = item.position as number;

                return (
                    <div
                        key={STABLE_MEDIA_KEYS[idx]}
                        className="space-y-1"
                    >
                        {cloudinaryUrl ? (
                            <img
                                src={cloudinaryUrl}
                                alt={t('social.posts.detail.media.position' as TranslationKey, {
                                    pos
                                })}
                                className="aspect-square w-full rounded-md border object-cover"
                            />
                        ) : (
                            <div className="flex aspect-square w-full items-center justify-center rounded-md border bg-muted text-muted-foreground text-xs">
                                {t('social.posts.detail.media.pendingUpload' as TranslationKey)}
                            </div>
                        )}
                        <p className="text-center text-muted-foreground text-xs">
                            {t('social.posts.detail.media.position' as TranslationKey, { pos })}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}
