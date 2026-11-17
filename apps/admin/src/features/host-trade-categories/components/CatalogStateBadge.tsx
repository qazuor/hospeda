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
}

/**
 * Renders `ACTIVE` as a green pill and anything else as a muted "inactive".
 *
 * @param props - {@link CatalogStateBadgeProps}
 */
export function CatalogStateBadge({ lifecycleState }: CatalogStateBadgeProps) {
    const { t } = useTranslations();
    const isActive = lifecycleState === LifecycleStatusEnum.ACTIVE;

    return (
        <Badge variant={isActive ? 'success' : 'secondary'}>
            {t(catalogKey({ path: isActive ? 'state.active' : 'state.inactive' }))}
        </Badge>
    );
}
