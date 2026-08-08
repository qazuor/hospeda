/**
 * @fileoverview
 * Data migration: 0047-hos-294-retire-bronze-tier
 *
 * Moves every partner still on the `bronze` tier to `silver`, so the value can
 * be dropped from the `partner_tier` Postgres enum.
 *
 * ## Why bronze is going away
 *
 * The owner defined exactly two commercial partner tiers (HOS-278 D4): silver
 * (carousel presence) and gold (carousel presence plus its own page at
 * `/partners/<slug>/`). `bronze` predates that decision and has no plan, no
 * price and no product meaning — `ALL_PARTNER_PLANS` carries `partner-listing`,
 * `partner-silver` and `partner-gold`, and nothing else. Leaving a third value
 * in the enum means every tier comparison in the codebase has to keep answering
 * a question the product no longer asks.
 *
 * ## Why silver and not gold
 *
 * Silver is the tier that grants LESS. Promoting a bronze partner to gold would
 * hand them a public page they never paid for, which is the one outcome that
 * cannot be undone quietly — the page would be indexed before anyone noticed.
 * Demoting to silver is reversible by an admin in one edit.
 *
 * ## In practice this is a NO-OP, and that is by design
 *
 * The real rewrite happens in the STRUCTURAL migration
 * (`0085_known_agent_zero.sql`), which carries a hand-added
 * `UPDATE partners SET tier='silver' WHERE tier='bronze'` immediately before it
 * drops the enum value.
 *
 * It had to go there. Postgres has no `ALTER TYPE ... DROP VALUE`, so dropping
 * `bronze` means rewriting the column with `USING`, and that cast FAILS on any
 * row still holding the old value. The documented run order on a live
 * environment is `db:migrate` → `db:apply-extras` → `db:seed:migrate`, so this
 * file executes AFTER the structural one: relying on it would have meant the
 * deploy failing at the `ALTER TABLE` before this ever got a turn. See the
 * spec's R-2.
 *
 * So why keep it? Two reasons, neither of them "just in case":
 *
 * 1. The dual-write rule (HOS-25) requires it. The seed baselines for two
 *    partner fixtures changed from `bronze` to `silver`, and
 *    `scripts/check-seed-dual-write.sh` guards `data/partner/**` — verified by
 *    running it, not assumed.
 * 2. It is the honest record of a data decision (bronze partners become silver,
 *    not gold) in the place a reader looks for data decisions. The SQL states
 *    the same thing, but the SQL is where the mechanism lives, not the reason.
 *
 * Expect it to report zero rows on every environment where migrations ran
 * first. The comparison casts to `text`, so it is safe even though the enum no
 * longer has a `bronze` label at all.
 *
 * ## Dual-write
 *
 * The two seed fixtures that carried `tier: "bronze"`
 * (`003-partner-panaderia-la-espiga.json`, `005-partner-ong-amigos-del-rio-uruguay.json`)
 * were changed to `"silver"` in the same change, so a fresh `db:fresh` never
 * creates a bronze row in the first place.
 *
 * ## Idempotency
 *
 * The UPDATE is scoped to `tier = 'bronze'`, so a second run matches nothing and
 * reports zero. It never touches a partner on any other tier.
 *
 * ## `destructive` flag decision
 *
 * `true` — it overwrites a column value on existing rows. Nothing is deleted and
 * the change is reversible by an admin (set the tier back), but a value that was
 * there is not there afterwards, which is what the flag is asking about.
 */
import { partners } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0047-hos-294-retire-bronze-tier',
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

/** The tier being retired. */
const RETIRED_TIER = 'bronze';

/** Where its partners land. See the file header for why this is not gold. */
const REPLACEMENT_TIER = 'silver';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // Raw comparison rather than the typed enum: by the time anyone reads this,
    // `PartnerTierEnum` no longer HAS a bronze member, so a typed reference
    // would not compile. The string is the value in the database, which is what
    // this migration is about.
    const rewritten = await ctx.db
        .update(partners)
        .set({ tier: REPLACEMENT_TIER as (typeof partners.$inferSelect)['tier'] })
        .where(eq(sql`${partners.tier}::text`, RETIRED_TIER))
        .returning({ id: partners.id, slug: partners.slug });

    return {
        summary:
            rewritten.length > 0
                ? `Moved ${rewritten.length} partner(s) from ${RETIRED_TIER} to ${REPLACEMENT_TIER}: ${rewritten
                      .map((row) => row.slug)
                      .join(', ')}.`
                : `No partner was on the ${RETIRED_TIER} tier; nothing to move.`,
        counts: {
            partnersRetiered: rewritten.length
        }
    };
}
