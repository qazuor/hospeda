/**
 * @file CommerceListingModerationCard.tsx
 * The admin's reject control for a commerce listing (HOS-686, AC-26).
 *
 * A route with no control is reachable only by a hand-crafted request, so
 * `POST /:id/moderate` is not a rejection action until an admin can click it.
 * This card is where they click it, on the gastronomy and experience detail
 * routes.
 *
 * ## Why one component instead of two panels
 *
 * Gastronomy and experience inherit ONE `moderate()` from
 * `BaseCommerceListingService` (HOS-589 G-2). Giving each vertical its own
 * copy of the widget would reintroduce, in the panel, exactly the per-domain
 * divergence the shared base exists to prevent — the two would drift on copy,
 * on confirm behaviour, or on which permission gates them. Each route passes
 * its own mutation hook and entity label; nothing else differs.
 *
 * ## Why `InlineStateSelectCell`
 *
 * It is the established molde for this exact control on accommodations, posts
 * and events: a colored badge that opens a dropdown, renders read-only when the
 * user lacks the permission, and puts a confirmation dialog in front of the
 * destructive value. `REJECTED` is destructive here in the strongest sense —
 * it is what takes a paying listing off the public site.
 */

import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import {
    InlineStateSelectCell,
    type InlineUpdateMutationLike
} from '@/components/entity-list/InlineStateSelectCell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CONTENT_MODERATION_OPTIONS } from '@/features/content/config/content-state-options';
import { useTranslations } from '@/hooks/use-translations';
import type { ListingModerationPatch } from '../hooks/createCommerceEntityHooks';

/** Props for {@link CommerceListingModerationCard}. RO-RO pattern. */
export interface CommerceListingModerationCardProps {
    /** UUID of the listing being moderated. */
    readonly entityId: string;
    /** Human-readable listing name, interpolated into the success toast. */
    readonly entityName: string;
    /** i18n key for the singular entity label (e.g. gastronomy / experience). */
    readonly entityLabelKey: TranslationKey;
    /** Current `moderationState` of the listing. */
    readonly currentValue: unknown;
    /**
     * The vertical's listing-moderation mutation hook — `(id) => mutation`.
     * Must be the LISTING hook, never the review one: they post to different
     * endpoints and answer to different permissions.
     */
    readonly useModerateMutation: (id: string) => InlineUpdateMutationLike<ListingModerationPatch>;
}

/**
 * Renders the listing's moderation verdict as an inline-editable badge.
 *
 * @param props - Listing identity plus the vertical's moderate mutation hook.
 */
export function CommerceListingModerationCard({
    entityId,
    entityName,
    entityLabelKey,
    currentValue,
    useModerateMutation
}: CommerceListingModerationCardProps) {
    const { t } = useTranslations();

    return (
        <Card data-testid="commerce-listing-moderation">
            <CardHeader>
                <CardTitle className="font-medium text-sm">
                    {t('admin-entities.columns.moderation')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <InlineStateSelectCell<ListingModerationPatch>
                    entityId={entityId}
                    entityName={entityName}
                    entityLabelKey={entityLabelKey}
                    field="moderationState"
                    currentValue={currentValue}
                    successMessageKey="admin-entities.messages.moderationChanged"
                    options={CONTENT_MODERATION_OPTIONS(t)}
                    permission={PermissionEnum.COMMERCE_MODERATION_CHANGE}
                    useUpdateMutation={useModerateMutation}
                    confirmValues={['REJECTED']}
                    confirmCopyKey="reject"
                />
            </CardContent>
        </Card>
    );
}
