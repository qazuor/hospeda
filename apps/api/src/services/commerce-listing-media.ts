/**
 * Relational media loader for the commerce publish-readiness gate
 * (H-154 / HOS-494).
 *
 * ## Why this module exists
 *
 * `resolveListingCompleteness` (`@repo/schemas`) requires a `media.featuredImage`
 * before a commerce listing may be paid for or published. Until HOS-372 that
 * field lived on the listing row itself, in a `media` JSONB column, so both
 * consumers of the gate could read it straight off a `model.findById()` result.
 *
 * HOS-372 **dropped that column**. Photos now live only in the relational
 * `gastronomy_media` / `experience_media` tables, and `media` is recomposed at
 * read time — but that composition is a side effect of `GastronomyService` /
 * `ExperienceService`'s `_afterGetByField` / `_afterList` / `_afterSearch`
 * hooks. Code that reads the raw `@repo/db` model directly therefore gets a row
 * with **no `media` key at all**, and the gate correctly-but-uselessly reports
 * `missing: ['media.featuredImage']` for every listing in existence.
 *
 * Both raw-reading consumers had that bug independently, and both had a good
 * reason to be reading raw rather than switching to the service:
 *
 * - `routes/commerce/protected/start-subscription.ts` reads raw so a non-owner
 *   gets a uniform 403 (AC-2); `GastronomyService.getById`'s view-tier gating
 *   would 404 a non-owner on a still-DRAFT listing instead.
 * - `services/commerce-reconcile.service.ts` reads raw because it runs inside
 *   the reconciler's transaction with a narrow `CommerceEntityModel`.
 *
 * So the fix is not "use the service" — it is to load the same relational rows
 * the service would and run them through the **same pure composer**, which is
 * what this module does.
 *
 * ## Why it reuses `composeCommerceMedia` rather than `findFeatured`
 *
 * Because the gate must answer the featured-image question with the exact same
 * code that renders it. `composeCommerceMedia` is what builds the `media` a
 * visitor actually sees; reusing it means the gate and the public listing
 * cannot drift apart, which is the whole failure mode H-154 documents.
 *
 * The two candidate reads do differ in principle: `findFeatured()` filters on
 * `isFeatured` + `deletedAt` only, while `composeCommerceMedia` additionally
 * requires `state === 'visible'`. In practice they agree today, because a CHECK
 * constraint on both media tables (`chk_{gastronomy,experience}_media_featured_not_archived`)
 * makes an archived featured row impossible — so this is NOT a live bug in
 * `findFeatured`, and the choice here is not fixing one. But that agreement
 * rests on a constraint maintained in the extras carril rather than on the
 * gate's own logic, and "the gate happens to match the vitrine" is precisely
 * the kind of incidental alignment that stopped being true when HOS-372 landed.
 * Sharing the composer makes the alignment structural instead.
 *
 * @module services/commerce-listing-media
 */

import type { DrizzleClient } from '@repo/db';
import { experienceMediaModel, gastronomyMediaModel } from '@repo/db';
import type { CommerceEntityType, Media } from '@repo/schemas';
import { composeCommerceMedia } from '@repo/service-core';

/** Input to {@link loadCommerceListingMedia}. */
export interface LoadCommerceListingMediaInput {
    /** Which commerce vertical the listing belongs to. Selects the media table. */
    readonly entityType: CommerceEntityType;
    /** UUID of the commerce listing whose media rows to load. */
    readonly entityId: string;
    /** Optional active transaction client, forwarded to the media model. */
    readonly tx?: DrizzleClient;
}

/**
 * Loads a commerce listing's relational media rows and composes them into the
 * `Media` shape the completeness gate expects.
 *
 * `videos` is deliberately NOT passed to the composer: it lives on the listing's
 * own `videos` column, and `resolveListingCompleteness` reads nothing but
 * `media.featuredImage`. Threading it through would force every caller to widen
 * its raw-row type for a field the gate never inspects.
 *
 * @param input - {@link LoadCommerceListingMediaInput}
 * @returns The composed {@link Media} — `{}` when the listing has no media rows,
 *   which is exactly what makes the gate report `media.featuredImage` as missing.
 * @throws {Error} Propagates a DB error from the media model (fail-hard: the
 *   relational table is the read source of truth — a swallowed error here would
 *   silently downgrade a complete listing to "incomplete").
 *
 * @example
 * ```ts
 * const media = await loadCommerceListingMedia({ entityType, entityId });
 * const { complete, missing } = resolveListingCompleteness({
 *   entityType,
 *   listing: { ...rawRow, media }
 * });
 * ```
 */
export async function loadCommerceListingMedia(
    input: LoadCommerceListingMediaInput
): Promise<Media> {
    const { entityType, entityId, tx } = input;

    // HOS-1079: an exhaustive switch, not a binary ternary — `entityType` is
    // typed `CommerceEntityType` (exactly 'gastronomy' | 'experience'), so the
    // `default` throw below is unreachable today by the compiler's own
    // guarantee, but keeps this file's selection logic self-defending if that
    // type is ever widened, instead of silently reading experience's media
    // for anything that is not literally 'gastronomy'.
    let grouped: Awaited<
        ReturnType<
            | typeof gastronomyMediaModel.findByGastronomies
            | typeof experienceMediaModel.findByExperiences
        >
    >;
    switch (entityType) {
        case 'gastronomy':
            grouped = await gastronomyMediaModel.findByGastronomies({
                gastronomyIds: [entityId],
                tx
            });
            break;
        case 'experience':
            grouped = await experienceMediaModel.findByExperiences({
                experienceIds: [entityId],
                tx
            });
            break;
        default: {
            const exhaustiveCheck: never = entityType;
            throw new Error(
                `loadCommerceListingMedia: unsupported entityType '${exhaustiveCheck}'`
            );
        }
    }

    return composeCommerceMedia({ rows: grouped.get(entityId) ?? [], videos: null });
}
