/**
 * @fileoverview
 * Data migration: 0019-backfill-example-partners
 *
 * Dual-write counterpart (HOS-25) for HOS-172: backfills the 6 example
 * `partners` fixtures (`src/data/partner/*.json`, SPEC-271) onto an
 * already-seeded environment.
 *
 * These fixtures were added to the baseline in commit 24ce27a5f WITHOUT a
 * numbered data-migration, so already-seeded environments (prod) never
 * received them — the `partners` table shipped empty. A fresh DB gets them
 * directly from the baseline (`partners.seed.ts`); this migration carries
 * the same delta to environments seeded before that commit.
 *
 * Row data is read directly from the same fixture JSON files the baseline
 * seed reads (via `loadJsonFiles`), reusing `partnerNormalizer` from
 * `partners.seed.ts`, so the two can never drift.
 *
 * ## Idempotency
 *
 * Partners are created only when no row with the same `slug` already exists
 * (`partners.slug` is UNIQUE). `partners.seed.ts` does not opt into the
 * `deterministicId` seed-factory path (fixtures get a database-assigned
 * random id via `PartnerService.create()`), so — like the HOS-113 POI
 * migration before it — this backfill resolves existing rows by `slug`
 * rather than by a hardcoded UUID.
 *
 * The insert bypasses `PartnerService` and goes straight through
 * `PartnerModel` (same pattern as the HOS-113 POI migration and the seed
 * factory's own `deterministicId` direct-insert path). This is safe here:
 * `PartnerService._beforeCreate` only auto-generates a `slug` when one is
 * missing, and every fixture already carries a curated, unique `slug`, so
 * the only service-level hook that could fire is a guaranteed no-op.
 *
 * ## `destructive` flag decision
 *
 * `false` — every operation here is an INSERT-if-missing. Nothing is ever
 * deleted or overwritten.
 */
import type { Partner } from '@repo/schemas';
import { partnerNormalizer } from '../example/partners.seed.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0019-backfill-example-partners',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The 6 example partner fixture filenames this migration backfills
 * (HOS-172). Deliberately a fixed list, not `exampleManifest.partners` — a
 * future PR that adds MORE partners ships its own migration for that delta;
 * this one must stay frozen to what shipped (unbackfilled) in 24ce27a5f.
 */
const PARTNER_FIXTURE_FILES = [
    '001-partner-autoservice-litoral.json',
    '002-partner-supermercado-don-jose.json',
    '003-partner-panaderia-la-espiga.json',
    '004-partner-fundacion-entre-rios-sustentable.json',
    '005-partner-ong-amigos-del-rio-uruguay.json',
    '006-partner-universidad-tecnologica-del-litoral.json'
] as const;

/**
 * Shape of a raw partner fixture item, as loaded from
 * `src/data/partner/*.json`, before normalization.
 */
interface RawPartnerFixture {
    readonly slug: string;
    readonly startsAt: string;
    readonly endsAt?: string;
    readonly [key: string]: unknown;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const partnerModel = new ctx.models.PartnerModel();

    const counts: Record<string, number> = {
        partnersCreated: 0,
        partnersSkipped: 0
    };

    const rawPartners = await loadJsonFiles<RawPartnerFixture>('partner', [
        ...PARTNER_FIXTURE_FILES
    ]);

    for (const rawPartner of rawPartners) {
        const existing = await partnerModel.findOne({ slug: rawPartner.slug }, ctx.db);
        if (existing) {
            counts.partnersSkipped = (counts.partnersSkipped ?? 0) + 1;
            continue;
        }

        const normalized = partnerNormalizer(rawPartner as unknown as Record<string, unknown>);

        await partnerModel.create(
            {
                ...normalized,
                // The normalizer forwards these as ISO strings (relying on
                // `createPartnerSchema`'s `z.coerce.date()` when going through
                // the service). This migration bypasses the service, so the
                // coercion is done explicitly here instead.
                startsAt: new Date(rawPartner.startsAt),
                endsAt: rawPartner.endsAt ? new Date(rawPartner.endsAt) : undefined,
                createdById: ctx.actor.id,
                updatedById: ctx.actor.id
            } as Partial<Partner>,
            ctx.db
        );
        counts.partnersCreated = (counts.partnersCreated ?? 0) + 1;
    }

    return {
        summary: `HOS-172 example-partners backfill: ${counts.partnersCreated} partner(s) created (${counts.partnersSkipped} already existed).`,
        counts
    };
}
