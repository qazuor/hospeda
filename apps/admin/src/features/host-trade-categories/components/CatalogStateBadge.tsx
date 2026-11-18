/**
 * @file CatalogStateBadge.tsx
 * @description Active / inactive pill shared by both catalog tables (HOS-919).
 */

import { LifecycleStatusEnum } from '@repo/schemas';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';
import { catalogKey } from '../lib/i18n-keys';

/** Props for {@link CatalogStateBadge}. */
export interface CatalogStateBadgeProps {
    readonly lifecycleState: string;
    /** Set when the row is soft-deleted (HOS-2340): the badge then reads "Deleted". */
    readonly deletedAt?: string | Date | null;
}

/**
 * Renders a soft-deleted row as a "Deleted" pill (text, not colour only), `ACTIVE`
 * as a green pill and anything else as a muted "inactive".
 *
 * @param props - {@link CatalogStateBadgeProps}
 */
export function CatalogStateBadge({ lifecycleState, deletedAt }: CatalogStateBadgeProps) {
    const { t } = useTranslations();
    const isActive = lifecycleState === LifecycleStatusEnum.ACTIVE;

    if (deletedAt) {
        return <Badge variant="destructive">{t(catalogKey({ path: 'state.deleted' }))}</Badge>;
    }

    return (
        <Badge variant={isActive ? 'success' : 'secondary'}>
            {t(catalogKey({ path: isActive ? 'state.active' : 'state.inactive' }))}
        </Badge>
    );
}
