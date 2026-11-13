import { planCatalogModel } from '@repo/db';
import { createPlanCatalogInverse } from '@repo/verticals';

/** Compose the production plan catalog contract for action 17. */
export function planMigrationVerticals() {
    return createPlanCatalogInverse({ reader: planCatalogModel });
}
