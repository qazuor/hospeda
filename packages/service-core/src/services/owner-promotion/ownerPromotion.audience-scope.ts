/**
 * Tourist-audience scope of the public owner-promotion search (HOS-2590).
 *
 * A promotion's `touristAudience` is `plus` (everybody) or `vip` (VIP tourists
 * only). The public search used to ignore it, so a VIP-only promotion reached
 * every reader. The caller (the API route, which can read the actor's effective
 * set) resolves the scope and hands it over through the service context; the
 * service never decides it from a role. Absent or malformed, the scope is PLUS
 * only, so a caller that forgets it fails closed.
 */
import { TouristAudienceEnum, TouristAudienceEnumSchema } from '@repo/schemas';
import type { SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { ServiceContext } from '../../types';
import { buildTouristAudienceCondition } from './ownerPromotion.exclusive-deals';

/** `hookState` key carrying the reader's audience scope. */
const AUDIENCE_SCOPE_KEY = 'touristAudienceScope';

/** The scope every reader gets: promotions for everybody. */
const DEFAULT_SCOPE: readonly TouristAudienceEnum[] = [TouristAudienceEnum.PLUS];

const AudienceScopeSchema = z.array(TouristAudienceEnumSchema).min(1);

/**
 * Builds the service context that carries the reader's audience scope into
 * `OwnerPromotionService.search()` / `count()`.
 *
 * @param params - `audienceScope`: the audiences the reader may see, resolved
 *   from the effective set (`vip` only with `vip_promotions_access`).
 * @returns A `ServiceContext` to pass as the third argument of `search()`.
 */
export function buildOwnerPromotionAudienceContext({
    audienceScope
}: {
    readonly audienceScope: readonly TouristAudienceEnum[];
}): ServiceContext {
    return { hookState: { [AUDIENCE_SCOPE_KEY]: [...audienceScope] } };
}

/**
 * Reads the audience scope out of a service context, PLUS only when it is
 * absent or malformed.
 *
 * @param params - `ctx`: the context `_executeSearch` / `_executeCount` received.
 * @returns The audiences the public search may return.
 */
export function resolveOwnerPromotionAudienceScope({
    ctx
}: {
    readonly ctx: ServiceContext | undefined;
}): readonly TouristAudienceEnum[] {
    const parsed = AudienceScopeSchema.safeParse(ctx?.hookState?.[AUDIENCE_SCOPE_KEY]);
    return parsed.success ? parsed.data : DEFAULT_SCOPE;
}

/**
 * The audience scope of a public search plus its SQL condition, for the
 * generic (`findAll` / `count`) and the accommodation (D-4) read paths.
 *
 * @param params - `ctx`: the context `_executeSearch` / `_executeCount` received.
 * @returns `touristAudiences` (for the model's accommodation reads) and
 *   `audienceCondition` (the `touristAudience IN (...)` condition).
 */
export function resolvePublicAudienceFilter({
    ctx
}: {
    readonly ctx: ServiceContext | undefined;
}): { readonly touristAudiences: readonly TouristAudienceEnum[]; readonly audienceCondition: SQL } {
    const touristAudiences = resolveOwnerPromotionAudienceScope({ ctx });
    return {
        touristAudiences,
        audienceCondition: buildTouristAudienceCondition({ scope: touristAudiences })
    };
}
