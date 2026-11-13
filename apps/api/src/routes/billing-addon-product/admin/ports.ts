import { planCatalogModel } from '@repo/db';
import { createPlanCatalogInverse } from '@repo/verticals';

/** Builds the real inverse addon policy port for action 20. */
export function buildAddonVersionPublicationPorts() {
    return { addonPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).addonPolicy };
}
