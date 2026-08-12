/**
 * @fileoverview
 * Data migration: 0054-hos374-editorial-trusted-editor
 *
 * Makes the platform's editorial author (`editorial@hospeda.com.ar`, created by
 * `0025-seed-real-blog-posts`) a **trusted editor** (HOS-374 §5.1.2 / OQ-1).
 *
 * ## Why the account needs it
 *
 * The `EDITOR` role grants authoring only: create a post/event and edit your
 * own. Publishing and deleting your own content are deliberately NOT in the
 * role — they are the four `TRUSTED_EDITOR_PERMISSIONS`, granted per user so
 * that a newly provisioned editor cannot publish straight to the public site.
 * `editorial@` is not a newly provisioned editor: it is the account the real
 * blog and the imported event agenda are attributed to (`0025`, `0042`), so it
 * must be able to run its own content end to end without an admin performing
 * the publish step for it.
 *
 * ## Why the bundle is never restated here
 *
 * The permissions are DERIVED from `TRUSTED_EDITOR_PERMISSIONS`, the single
 * source of truth in `@repo/schemas`. A fifth permission joining that tuple
 * must reach this migration without anyone editing it — a local copy of the
 * list would drift silently and leave the account half-promoted, which is the
 * exact "publish but not delete" state the bundle's atomicity exists to
 * prevent.
 *
 * ## No baseline counterpart (dual-write rule)
 *
 * The dual-write rule asks for a matching baseline edit so a fresh DB lands in
 * the same state. There is nothing to edit here: `editorial@` is not part of any
 * baseline fixture — it is itself created by data-migration `0025`, and every
 * later migration touching it (`0041` slug, `0042` re-attribution, `0043`
 * avatar) resolves it by email for the same reason. A fresh `db:fresh` runs
 * `0025` and then this file, so both paths converge.
 *
 * ## `destructive` flag decision
 *
 * `false` — this only ADDS `grant` rows for one identified user. It deletes
 * nothing and narrows no access, so the production destructive-migration gate
 * does not apply. It is reversible by deleting the four rows.
 */
import { eq, userPermission, users } from '@repo/db';
import { TRUSTED_EDITOR_PERMISSIONS } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0054-hos374-editorial-trusted-editor',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Unique identity of the editorial author created by `0025`. */
const EDITORIAL_EMAIL = 'editorial@hospeda.com.ar';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const [editorial] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, EDITORIAL_EMAIL))
        .limit(1);

    if (!editorial) {
        return {
            summary: `Editorial author "${EDITORIAL_EMAIL}" is absent from this environment; nothing to grant.`,
            counts: { granted: 0 }
        };
    }

    // `user_permission` has a composite PK `(user_id, permission)`. An existing
    // row is upgraded to `grant` rather than skipped: a stale `deny` for one of
    // the four would otherwise survive and leave the account half-promoted,
    // which is precisely the partial state the bundle must never be in. This
    // mirrors the real service's upsert semantics.
    const rows = TRUSTED_EDITOR_PERMISSIONS.map((permission) => ({
        userId: editorial.id,
        permission,
        effect: 'grant' as const
    }));

    await ctx.db
        .insert(userPermission)
        .values(rows)
        .onConflictDoUpdate({
            target: [userPermission.userId, userPermission.permission],
            set: { effect: 'grant' }
        });

    return {
        summary: `Granted the ${rows.length} trusted-editor permission(s) to "${EDITORIAL_EMAIL}".`,
        counts: { granted: rows.length }
    };
}
