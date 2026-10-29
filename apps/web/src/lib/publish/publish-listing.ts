/**
 * Shared publish dispatch and navigation for listing verticals.
 *
 * @remarks The API remains the authority for publish eligibility; this module
 * only selects the vertical endpoint and its existing destination paths.
 */

import {
    accommodationEditApi,
    type PublishVerticalSlug,
    publishApi
} from '@/lib/api/endpoints-protected';
import type { ApiResult } from '@/lib/api/types';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';

/** Publish endpoint handler for every supported listing vertical. */
type PublishHandler = (input: {
    readonly id: string;
}) => Promise<ApiResult<Record<string, unknown>>>;

/** Existing publish endpoint selection, exhaustive across listing verticals. */
const PUBLISH_HANDLER_BY_VERTICAL: Readonly<Record<PublishVerticalSlug, PublishHandler>> = {
    accommodation: ({ id }) => accommodationEditApi.publish({ id }),
    venue: ({ id }) => publishApi.publish({ vertical: 'venue', id }),
    experience: ({ id }) => publishApi.publish({ vertical: 'experience', id })
};

/** Existing pricing audience per listing vertical. */
const PRICING_AUDIENCE_BY_VERTICAL: Readonly<
    Record<PublishVerticalSlug, keyof typeof PRICING_PAGE_PATH_BY_AUDIENCE>
> = {
    accommodation: 'owner',
    venue: 'venue',
    experience: 'experience'
};

/** Editor path builder for each listing vertical. */
const EDITOR_PATH_BY_VERTICAL: Readonly<Record<PublishVerticalSlug, (id: string) => string>> = {
    accommodation: (id) => `mi-cuenta/propiedades/${id}/editar`,
    venue: (id) => `mi-cuenta/comercio/venue/${id}/editar`,
    experience: (id) => `mi-cuenta/comercio/experience/${id}/editar`
};

/**
 * Dispatch a listing publish request to its vertical's existing endpoint.
 *
 * @param input.vertical - Listing vertical.
 * @param input.id - Listing identifier.
 * @returns The endpoint's result.
 */
export function publishListing({
    vertical,
    id
}: {
    readonly vertical: PublishVerticalSlug;
    readonly id: string;
}): Promise<ApiResult<Record<string, unknown>>> {
    return PUBLISH_HANDLER_BY_VERTICAL[vertical]({ id });
}

/**
 * Resolve the existing pricing page for a listing vertical.
 *
 * @param input.vertical - Listing vertical.
 * @returns The path from the canonical pricing audience map.
 */
export function resolvePublishPricingPath({
    vertical
}: {
    readonly vertical: PublishVerticalSlug;
}): string {
    return PRICING_PAGE_PATH_BY_AUDIENCE[PRICING_AUDIENCE_BY_VERTICAL[vertical]];
}

/**
 * Resolve the existing editor path for a listing vertical.
 *
 * @param input.vertical - Listing vertical.
 * @param input.id - Listing identifier.
 * @returns The path to that listing's editor.
 */
export function resolvePublishEditorPath({
    vertical,
    id
}: {
    readonly vertical: PublishVerticalSlug;
    readonly id: string;
}): string {
    return EDITOR_PATH_BY_VERTICAL[vertical](id);
}
