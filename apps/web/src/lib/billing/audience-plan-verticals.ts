import type { PublicPlanCatalogVertical } from '@repo/schemas';
import type { AudienceCardId } from './audience-plans';

/** Catalog vertical read for each pricing audience. */
export const AUDIENCE_PLAN_VERTICALS: Readonly<Record<AudienceCardId, PublicPlanCatalogVertical>> =
    {
        host: 'accommodation',
        tourist: 'tourist',
        gastronomy: 'gastronomy',
        experience: 'experience'
    };
