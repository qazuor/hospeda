import type { AdminListingFixRequestItem } from '@repo/schemas';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ListingModerationActions } from '@/features/listing/components/ListingModerationActions';
import { useTranslations } from '@/hooks/use-translations';

/** Inline moderation disclosure for one fix request. */
export function FixRequestRowActions({ item }: { readonly item: AdminListingFixRequestItem }) {
    const [expanded, setExpanded] = useState(false);
    const { t } = useTranslations();
    return (
        <div data-testid={`fix-request-actions-${item.fixRequestId}`}>
            <Button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
            >
                {t(
                    expanded
                        ? 'admin-entities.fixRequestList.hideModerate'
                        : 'admin-entities.fixRequestList.moderate'
                )}
            </Button>
            {expanded && (
                <ListingModerationActions
                    vertical={item.vertical}
                    entityId={item.listingId}
                    entityName={item.listingName}
                />
            )}
        </div>
    );
}
