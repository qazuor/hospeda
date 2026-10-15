import { planCatalogModel } from '@repo/db';
import type { ComplementPolicyPorts } from '@repo/service-core';
import { permanentGrantLiveAnchors } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { createApiListingInverse } from './listing-publication/listing-inverse';

/** Builds the real policy ports used by recurring complement transitions. */
export function buildComplementPolicyPorts(): ComplementPolicyPorts {
    return {
        addonPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).addonPolicy,
        listing: createApiListingInverse().listing,
        liveAnchors: permanentGrantLiveAnchors
    };
}
