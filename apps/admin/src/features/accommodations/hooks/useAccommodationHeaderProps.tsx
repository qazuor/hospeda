/**
 * useAccommodationHeaderProps — derives the EntityPageHeader props
 * (media / subtitle / badges) from a loaded accommodation entity.
 *
 * Centralizes the header derivation so both the view (`$id.tsx`) and edit
 * (`$id_.edit.tsx`) routes render the same chrome. Returns `undefined` /
 * `null` fields when the entity isn't loaded yet so the header degrades
 * gracefully during the loading state.
 */

import type { ReactNode } from 'react';
import { useMemo } from 'react';

import type { EntityPageHeaderMedia } from '@/components/entity-header/EntityPageHeader';
import {
    getLifecycleStateBadgeOptions,
    getModerationStateBadgeOptions,
    getVisibilityBadgeOptions
} from '@/components/entity-list/columns.factory.types';
import { BadgeCell } from '@/components/table/cells/BadgeCell';
import { useTranslations } from '@repo/i18n';
import { getAccommodationTypeIcon } from '@repo/icons';

import type { AccommodationCore } from '../schemas/accommodation-client.schema';

export interface UseAccommodationHeaderPropsArgs {
    /** The accommodation entity returned by the page hook; `undefined` while loading. */
    readonly entity: AccommodationCore | undefined;
}

export interface AccommodationHeaderProps {
    /** Header media slot (thumbnail with type-icon fallback). */
    readonly media: EntityPageHeaderMedia | undefined;
    /** "<TypeLabel> · <DestinationName>" — undefined when neither is known. */
    readonly subtitle: string | undefined;
    /** Stack of state badges (visibility · lifecycle · moderation). */
    readonly badges: ReactNode;
}

export const useAccommodationHeaderProps = ({
    entity
}: UseAccommodationHeaderPropsArgs): AccommodationHeaderProps => {
    const { t } = useTranslations();

    return useMemo<AccommodationHeaderProps>(() => {
        if (!entity) {
            return { media: undefined, subtitle: undefined, badges: null };
        }

        const entityRecord = entity as unknown as Record<string, unknown>;

        // ---- Media (thumbnail with type-icon fallback) --------------------
        const media = buildHeaderMedia(entityRecord);

        // ---- Subtitle ("<Type> · <Destination>") --------------------------
        const subtitle = buildSubtitle(entityRecord, t);

        // ---- Badges (visibility / lifecycle / moderation) -----------------
        const badges = buildBadges(entityRecord, t);

        return { media, subtitle, badges };
    }, [entity, t]);
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildHeaderMedia(entity: Record<string, unknown>): EntityPageHeaderMedia {
    const media = entity.media as { featuredImage?: { url?: string } } | undefined;
    const src = media?.featuredImage?.url;
    const type = (entity.type as string | undefined) ?? '';
    const TypeIcon = getAccommodationTypeIcon({ type });
    const alt = (entity.name as string | undefined) ?? '';

    return {
        type: 'thumbnail',
        src,
        alt,
        fallback: (
            <TypeIcon
                size="lg"
                weight="duotone"
                aria-hidden="true"
            />
        )
    };
}

function buildSubtitle(
    entity: Record<string, unknown>,
    t: (key: string) => string
): string | undefined {
    const type = entity.type as string | undefined;
    const cityDestination = entity.cityDestination as { name?: string } | null | undefined;

    const typeKey = type ? `common.enums.accommodationType.${type.toLowerCase()}` : undefined;
    const typeLabel = typeKey ? t(typeKey) || type : undefined;
    const destinationName = cityDestination?.name;

    const parts = [typeLabel, destinationName].filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(' · ') : undefined;
}

function buildBadges(entity: Record<string, unknown>, t: (key: string) => string): ReactNode {
    const visibility = entity.visibility as string | undefined;
    const lifecycleState = entity.lifecycleState as string | undefined;
    const moderationState = entity.moderationState as string | undefined;

    const tFn = t as Parameters<typeof getVisibilityBadgeOptions>[0];

    return (
        <>
            {visibility && (
                <BadgeCell
                    value={visibility}
                    options={getVisibilityBadgeOptions(tFn)}
                />
            )}
            {lifecycleState && (
                <BadgeCell
                    value={lifecycleState}
                    options={getLifecycleStateBadgeOptions(tFn)}
                />
            )}
            {moderationState && (
                <BadgeCell
                    value={moderationState}
                    options={getModerationStateBadgeOptions(tFn)}
                />
            )}
        </>
    );
}
