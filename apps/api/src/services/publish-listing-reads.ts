/**
 * The two reads the publish precheck needs, for any publish vertical (HOS-1156
 * T-006/T-007).
 *
 * ---
 * WHY THE COUNT LIVES HERE AND NOT IN THE MIDDLEWARE THAT OWNS THE CAP
 *
 * {@link countOwnListings} was private to `commerce-limit-enforcement.ts`, which
 * is the middleware that actually REFUSES an over-cap create. The precheck needs
 * the same number to decide whether to show a form or an upgrade panel — and if
 * the two counted differently, the precheck would tell an owner "you have room"
 * and the create endpoint would answer 403 one screen later. That divergence
 * cannot be caught by either side's tests, because each would be self-consistent.
 *
 * So there is one count, imported by both. The middleware keeps deciding; this
 * module only reads.
 * ---
 *
 * ## The two callers fail in OPPOSITE directions, deliberately
 *
 * A count that cannot be resolved means something different on each side, and
 * the difference is not an inconsistency to tidy up:
 *
 * - **The enforcement middleware fails CLOSED** — 503. It is the only gate on the
 *   create path, so an unresolved count there would hand out an uncapped listing,
 *   indistinguishable from a working one until somebody counts rows.
 * - **The precheck fails OPEN** — `create_direct`, i.e. show the form. The real
 *   cap still sits behind it in that same middleware, so a transient failure here
 *   costs an owner a friendly dialog, never the limit itself.
 *
 * That is why these functions return `null` on failure rather than throwing: the
 * policy belongs to the caller, and the two callers have opposite ones.
 *
 * @module services/publish-listing-reads
 */

import type { PublishVertical } from '@repo/billing';
import { LifecycleStatusEnum } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    ExperienceService,
    GastronomyService
} from '@repo/service-core';
import { apiLogger } from '../utils/logger';

/**
 * The three services are built on FIRST USE, never at module load.
 *
 * A service constructor reaches into `@repo/db` for its model, and this module
 * is imported by `middlewares/commerce-limit-enforcement.ts` — a middleware, so
 * the import lands in a large share of the API's test files. Constructing at
 * module load therefore ran a real `@repo/db` read inside every one of them,
 * against the whole-module `vi.mock('@repo/db')` that `test/setup.ts` installs:
 * the mock declares no `AccommodationModel`, so the import itself threw before
 * any test body ran (CI shard 5/5). Same reasoning as
 * `buildAccommodationPublishDeps`, which takes a billing *getter* rather than a
 * client so a route module instantiated at boot resolves lazily.
 *
 * Memoised, so the request path still pays one construction per process.
 */
let accommodationService: AccommodationService | null = null;
let gastronomyService: GastronomyService | null = null;
let experienceService: ExperienceService | null = null;

const getAccommodationService = (): AccommodationService => {
    accommodationService ??= new AccommodationService({ logger: apiLogger });
    return accommodationService;
};

const getGastronomyService = (): GastronomyService => {
    gastronomyService ??= new GastronomyService({ logger: apiLogger });
    return gastronomyService;
};

const getExperienceService = (): ExperienceService => {
    experienceService ??= new ExperienceService({ logger: apiLogger });
    return experienceService;
};

/**
 * Max number of DRAFT rows returned. Onboarding drafts are always few (the
 * decision matrix caps meaningfully at ">1"); this bound only guards against
 * pathological data. Mirrors the constant the accommodation precheck already
 * used.
 */
const MAX_DRAFTS_RETURNED = 50;

/** One DRAFT listing, in the shape the precheck panel's picker renders. */
export interface PublishDraft {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
}

/**
 * The service that owns one publish vertical's listings.
 *
 * An exhaustive switch, not a lookup object: the three services have no common
 * nameable supertype, and a `default` that returned one of them would be the
 * "anything that is not X is Y" shape HOS-1079 removed from five call sites.
 */
function serviceFor(vertical: PublishVertical) {
    switch (vertical) {
        case 'accommodation':
            return getAccommodationService();
        case 'gastronomy':
            return getGastronomyService();
        case 'experience':
            return getExperienceService();
        default: {
            // Defense in depth: `vertical` is already narrowed, so this is
            // unreachable today. It exists so that widening PublishVertical
            // without touching this file is a compile error.
            const exhaustiveCheck: never = vertical;
            apiLogger.error(
                { vertical: exhaustiveCheck },
                'publish-listing-reads: unsupported publish vertical'
            );
            return null;
        }
    }
}

/**
 * Counts the listings one owner holds in one vertical.
 *
 * `ownerId` is a declared filter on all three search schemas — checked rather
 * than assumed, because a search schema that silently drops an undeclared filter
 * would count every listing on the platform and cap the first owner who tried to
 * create one.
 *
 * Counts across every lifecycle state, drafts included, because that is what the
 * cap counts: a DRAFT listing occupies a slot exactly as a published one does.
 * Soft-deleted rows are excluded by the service layer's own default.
 *
 * @param input.vertical - Which vertical to count.
 * @param input.actor - The authenticated actor, who is also the owner.
 * @returns The count, or `null` when it could not be resolved. See the module
 *   doc: the caller owns the failure policy, and the two callers differ.
 */
export async function countOwnListings(input: {
    vertical: PublishVertical;
    actor: Actor;
}): Promise<number | null> {
    const { vertical, actor } = input;

    const service = serviceFor(vertical);
    if (!service) {
        return null;
    }

    // TYPE-WORKAROUND: BaseCrudService.count() takes z.infer<TSearchSchema> and
    // TypeScript cannot narrow the generic at a call site that is polymorphic
    // over three services. Mirrors the assertion the enforcement middleware and
    // the accommodation precheck both already make.
    const result = await service.count(actor, { ownerId: actor.id } as never);

    if (result.error) {
        apiLogger.error(
            { vertical, ownerId: actor.id, error: result.error.message },
            'failed to count listings for the publish precheck'
        );
        return null;
    }

    return result.data?.count ?? 0;
}

/**
 * Lists one owner's DRAFT listings in one vertical.
 *
 * ## Why this reads through `list()` and not the vertical's `/mine` endpoint
 *
 * `CommerceOwnerListingSummarySchema` — what `GET /{vertical}/mine` returns —
 * carries `isPublic` and NOT `lifecycleState` (HOS-1156 F-1). Those are not the
 * same question: a finished listing waiting on checkout is non-public and is not
 * a draft. Deriving "half-finished" from that projection would count listings the
 * owner already completed, and offer to "resume" one that needs nothing.
 *
 * `list()` validates against `listOptionsSchema`, which declares `where` as an
 * open record, so the lifecycle filter reaches the model rather than being
 * stripped the way an undeclared *search* filter would be.
 *
 * @param input.vertical - Which vertical to read.
 * @param input.actor - The authenticated actor, who is also the owner.
 * @returns The owner's drafts (newest first, capped), or `null` when the read
 *   failed.
 */
export async function listOwnDraftListings(input: {
    vertical: PublishVertical;
    actor: Actor;
}): Promise<readonly PublishDraft[] | null> {
    const { vertical, actor } = input;

    const service = serviceFor(vertical);
    if (!service) {
        return null;
    }

    const result = await service.list(actor, {
        page: 1,
        pageSize: MAX_DRAFTS_RETURNED,
        where: {
            ownerId: actor.id,
            lifecycleState: LifecycleStatusEnum.DRAFT,
            deletedAt: null
        },
        sortBy: 'createdAt',
        sortOrder: 'desc'
    });

    if (result.error) {
        apiLogger.error(
            { vertical, ownerId: actor.id, error: result.error.message },
            'failed to list draft listings for the publish precheck'
        );
        return null;
    }

    const items = result.data?.items ?? [];

    return items.map((item) => ({
        id: String(item.id),
        slug: String(item.slug),
        name: String(item.name)
    }));
}

// `isCommercePublishVertical` used to be re-exported from here, so that callers
// in this module's orbit had one import rather than two. That saved an import
// line and cost a day: this module is MOCKED by the precheck's test, which
// rebuilds it as `{ ...actual, ...stubs }`, and spreading an ESM namespace
// copies values rather than live bindings — so the re-export reached the
// consumer as `undefined` depending on module evaluation order, and the
// precheck's fail-open turned that into six wrong decisions with no error
// anywhere. Its one consumer now imports it from `@repo/billing` directly.
//
// The rule this leaves behind: a module that any test mocks wholesale must
// export only what it OWNS. A re-export through it is a binding whose validity
// depends on somebody else's mocking strategy.
