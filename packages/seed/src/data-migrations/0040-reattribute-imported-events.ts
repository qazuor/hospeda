/**
 * @fileoverview
 * Data migration: 0040-reattribute-imported-events
 *
 * Moves the bulk-imported events off the super-admin account and onto the
 * shared editorial author ("Equipo Hospeda").
 *
 * ## Why this exists
 *
 * `0027`/`0028` insert their event batches with `authorId = ctx.actor.id` — the
 * super admin the migration runner acts as — and never set `createdById`. That
 * pair (`author_id = <super admin>`, `created_by_id IS NULL`) is the signature
 * of a bulk import, not of a human using the UI. 44 rows carry it in production
 * (52 locally).
 *
 * Under HOS-375 the author page becomes public and indexable, so that artifact
 * stops being cosmetic: it would publish `/es/autores/super-admin-user/` —
 * titled "Super Admin", listing 44 events — to Google, exposing the site's root
 * administrative account as a public author profile. Attributing
 * platform-curated content to the editorial team account is simply the accurate
 * description of who curated it. See HOS-375 §6.10.3.
 *
 * ## The `created_by_id IS NULL` clause is load-bearing
 *
 * It is what keeps anything a human actually created attached to its real
 * author: every service-layer write path stamps `createdById`, so only the
 * import batches match. Do not drop it to "catch more rows".
 *
 * ## Resolving the two accounts
 *
 * The **editorial** account is resolved by `EDITORIAL_EMAIL`, the same stable
 * identity `0025` and `0035` use — never by slug or id, both of which differ per
 * environment.
 *
 * The **source** account is resolved by `SUPER_ADMIN_EMAIL` first, and falls
 * back to `ctx.actor.id` when that account does not exist. The fallback is not
 * defensive padding, it covers a real documented procedure: a production
 * bootstrap runs `--required --exclude=users` (so `superadmin@hospeda.com` is
 * deliberately never created), promotes a REAL person to `SUPER_ADMIN`, and only
 * then runs the migration ledger — see `docs/deployment/first-time-setup.md`.
 * On that path `0027`/`0028` attribute every imported event to that real
 * person's account, and an email-only lookup here would find nothing, skip, and
 * leave 44 imported events published under a human being's public author page.
 * `ctx.actor` IS the account those migrations ran as, which is exactly what the
 * spec means by "an artifact of the import running under the super-admin actor".
 *
 * Widening the source this way stays safe because the `created_by_id IS NULL`
 * clause, not the author identity, is what excludes human-authored content.
 *
 * ## `contentOnly` flag decision
 *
 * `true`. The rows this migration edits have NO fixture baseline: no
 * `src/data/event/**` fixture reproduces them (that folder is demo-only and
 * exempt from the dual-write guard), and they exist solely because `0027`/`0028`
 * created them — both themselves `contentOnly`. On a fresh build all four run
 * for real, in order, so a from-scratch environment converges on the same
 * attribution a live one gets. Stamping this applied instead would ledger it
 * forever without the rows ever moving. See HOS-375 §6.11 and
 * `docs/seed-migration-mechanics.md` (verdict M-C).
 *
 * ## Idempotency, and why a zero match is NOT automatically fine
 *
 * Re-running is a no-op: after the first pass no event still matches
 * `author_id = <source> AND created_by_id IS NULL`, because every one of them
 * now points at the editorial account. The migration reports the post-run match
 * count so that claim is observable rather than assumed.
 *
 * But "nothing matched" has TWO causes, and they are opposites:
 *
 * - **Already applied.** The editorial account holds the imported events. This
 *   is the idempotent re-run, and it succeeds.
 * - **Wrong source account.** `SUPER_ADMIN_EMAIL` is a hardcoded fixture email
 *   and the `ctx.actor.id` fallback only fires when that account is ABSENT. On
 *   an environment where `superadmin@hospeda.com` EXISTS but is not the account
 *   `0027`/`0028` actually ran as, the lookup succeeds, matches zero rows, and
 *   the fallback never engages. The 44 imported events stay attributed to
 *   whoever really imported them, `/es/autores/<their-slug>/` gets published to
 *   Google, and the ledger records the migration as applied — so it can never
 *   run again to fix it. AC-14 is silently unmet.
 *
 * The two are distinguished by asking whether the editorial account already
 * holds events with the import signature. If it does, this ran before. If it
 * does not, and the source matched nothing either, then nobody was
 * re-attributed and the migration THROWS — rolling back its transaction and
 * refusing the ledger entry, so the operator can fix the source and re-run.
 * Reporting success here is the one outcome that cannot be recovered from.
 *
 * ## Soft-deleted rows are included on purpose
 *
 * No `deleted_at IS NULL` clause: attribution is provenance, not visibility. A
 * soft-deleted import that is later restored must come back correctly
 * attributed, not carrying the super-admin byline the restore would republish.
 *
 * ## `destructive` flag decision
 *
 * `false` — rewrites one FK column on rows it identifies, deletes nothing, and
 * is exactly reversible: the moved set is precisely the editorial account's
 * events with `created_by_id IS NULL` (it authored zero events before this
 * migration), so pointing those back at the source account restores the prior
 * state.
 */
import { and, eq, events, isNull, users } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0040-reattribute-imported-events',
    group: 'required',
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

/** Unique identity of the editorial author created by `0025`. */
const EDITORIAL_EMAIL = 'editorial@hospeda.com.ar';

/**
 * Unique identity of the required-seed super-admin fixture
 * (`src/data/user/required/super-admin-user.json`) — the account `0027`/`0028`
 * ran as in every environment that seeded it. See the header for the fallback
 * used when it is absent.
 */
const SUPER_ADMIN_EMAIL = 'superadmin@hospeda.com';

/** Resolves one user id by its unique email, or `null` when absent. */
async function findUserIdByEmail(
    ctx: SeedMigrationCtx,
    email: string
): Promise<string | undefined> {
    const rows = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    return rows[0]?.id;
}

/** Counts events still matching the import signature for `authorId`. */
async function countImportedEvents(ctx: SeedMigrationCtx, authorId: string): Promise<number> {
    const rows = await ctx.db
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.authorId, authorId), isNull(events.createdById)));

    return rows.length;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const editorialId = await findUserIdByEmail(ctx, EDITORIAL_EMAIL);

    if (!editorialId) {
        return {
            summary: `Editorial author "${EDITORIAL_EMAIL}" is absent from this environment; nothing to re-attribute.`,
            counts: { eventsMatchedBefore: 0, eventsReattributed: 0, eventsMatchedAfter: 0 }
        };
    }

    // The seeded fixture first; the acting super admin only when it is absent.
    const sourceAuthorId = (await findUserIdByEmail(ctx, SUPER_ADMIN_EMAIL)) ?? ctx.actor.id;

    if (sourceAuthorId === editorialId) {
        // Not reachable today (the editorial account holds `EDITOR`, and the
        // runner's actor must hold `SUPER_ADMIN`), but re-attributing an account
        // to itself would report a meaningless count.
        return {
            summary:
                'Source and editorial account resolved to the same user; nothing to re-attribute.',
            counts: { eventsMatchedBefore: 0, eventsReattributed: 0, eventsMatchedAfter: 0 }
        };
    }

    const matchedBefore = await countImportedEvents(ctx, sourceAuthorId);

    if (matchedBefore === 0) {
        // Distinguish "already applied" from "resolved the wrong source". See
        // the header: only the first is a legitimate no-op, and only the
        // editorial account's own import-signature events can tell them apart
        // (it authored none before this migration).
        const alreadyReattributed = await countImportedEvents(ctx, editorialId);

        if (alreadyReattributed > 0) {
            return {
                summary: `Already applied: the editorial author holds ${alreadyReattributed} imported event(s) and none remain under ${sourceAuthorId}.`,
                counts: {
                    eventsMatchedBefore: 0,
                    eventsReattributed: 0,
                    eventsMatchedAfter: 0
                }
            };
        }

        throw new Error(
            `0040-reattribute-imported-events matched ZERO events and the editorial author holds none either, so nothing was re-attributed. ` +
                `The source account was resolved to ${sourceAuthorId} (from "${SUPER_ADMIN_EMAIL}", falling back to the running actor when absent), ` +
                `but no event carries "author_id = <that account> AND created_by_id IS NULL". ` +
                'Refusing to record this migration as applied: ledgering it would leave the bulk-imported events attributed to a real person and publish their author page (HOS-375 AC-14), with no way to re-run. ' +
                'Identify the account 0027/0028 actually ran as, then re-run.'
        );
    }

    const moved = await ctx.db
        .update(events)
        .set({ authorId: editorialId, updatedAt: new Date() })
        .where(and(eq(events.authorId, sourceAuthorId), isNull(events.createdById)))
        .returning({ id: events.id });

    const matchedAfter = await countImportedEvents(ctx, sourceAuthorId);

    // `matchedBefore > 0` is guaranteed by the guard above, so `moved.length`
    // can only be 0 here if a concurrent writer changed the rows mid-migration.
    // That is a genuine anomaly, not the "already applied" case, and must not be
    // ledgered as a success either.
    if (moved.length === 0) {
        throw new Error(
            `0040-reattribute-imported-events found ${matchedBefore} matching event(s) but updated none. ` +
                'A concurrent writer most likely changed them mid-migration. Refusing to record this as applied; re-run.'
        );
    }

    return {
        summary: `Re-attributed ${moved.length} imported event(s) from ${sourceAuthorId} to the editorial author (${matchedBefore} matched before, ${matchedAfter} after).`,
        counts: {
            eventsMatchedBefore: matchedBefore,
            eventsReattributed: moved.length,
            eventsMatchedAfter: matchedAfter
        }
    };
}
