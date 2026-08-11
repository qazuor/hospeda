/**
 * @fileoverview
 * Data migration: 0039-event-organizer-permissions
 *
 * Companion delta for NOSPEC:event-organizer-permissions: the seed's
 * `ROLE_PERMISSIONS` constant (`packages/seed/src/required/rolePermissions.seed.ts`)
 * has already been edited so a fresh `db:fresh`/`db:fresh-dev` reflects the new
 * grants — this migration is the delta for environments that already seeded
 * without them (staging/prod), per the HOS-25 seed dual-write rule.
 *
 * ## The bug
 *
 * The entire `eventOrganizer.*` granular permission family
 * (`EVENT_ORGANIZER_CREATE`, `_VIEW`, `_UPDATE`, `_DELETE`, `_RESTORE`,
 * `_HARD_DELETE` — `packages/schemas/src/enums/permission.enum.ts`) was granted
 * to ZERO roles. Every event-organizer route
 * (`apps/api/src/routes/event-organizer/admin/{create,list,getById,update,patch,
 * delete,restore,hardDelete}.ts` and `apps/api/src/routes/event-organizer/
 * protected/create.ts`) gates on this family, not on the legacy
 * `EVENT_ORGANIZER_MANAGE` (`event.organizer.manage`) permission — so nobody,
 * not even SUPER_ADMIN, could create/list/update/delete an event organizer
 * through the API. `EVENT_ORGANIZER_LIFECYCLE_CHANGE`, a sibling member of the
 * same family, was already granted to SUPER_ADMIN/ADMIN/EDITOR and is untouched
 * here — no route currently gates on it.
 *
 * ## What this migration grants
 *
 * - `SUPER_ADMIN` and `ADMIN`: the full family — `EVENT_ORGANIZER_CREATE`,
 *   `_VIEW`, `_UPDATE`, `_DELETE`, `_RESTORE`, `_HARD_DELETE`.
 * - `EDITOR`: `EVENT_ORGANIZER_CREATE` only. HOS-374 gives editors an inline
 *   "create an organizer" affordance inside the event create form at
 *   `/mi-cuenta`, because `EventCreateHttpSchema.organizerId` is a required
 *   UUID and an editor whose organizer isn't in the catalog would otherwise be
 *   stuck. An editor must NOT be able to list-admin, edit, delete, restore or
 *   hard-delete organizers, so none of the other five grants are included.
 *
 * `EVENT_ORGANIZER_MANAGE` (the legacy name) is left untouched on every role —
 * out of scope for this fix.
 *
 * ## `role_permission` table shape
 *
 * `role_permission` has a COMPOSITE primary key (`role`, `permission` — see
 * `packages/db/src/schemas/user/r_role_permission.dbschema.ts`). Insertion goes
 * through a plain `ctx.db.insert(rolePermission).values(...).onConflictDoNothing()`,
 * matching `0026-alliance-lead-permissions.ts` — a single idempotent round-trip,
 * no separate existence check needed.
 *
 * ## `destructive` flag decision
 *
 * `false` — this only ever ADDS grants (an `INSERT ... ON CONFLICT DO
 * NOTHING`). It never deletes or narrows access, so the production
 * destructive-migration gate does not apply.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0039-event-organizer-permissions',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The full `eventOrganizer.*` granular family granted to `SUPER_ADMIN` and `ADMIN`.
 *
 * Exported so the migration's own test can assert this list against the seed's
 * `ROLE_PERMISSIONS` directly. A test that re-declared the pairs locally would
 * compare its own copy to the seed and stay green while THIS array drifted.
 */
export const EVENT_ORGANIZER_FULL_FAMILY: readonly PermissionEnum[] = [
    PermissionEnum.EVENT_ORGANIZER_CREATE,
    PermissionEnum.EVENT_ORGANIZER_VIEW,
    PermissionEnum.EVENT_ORGANIZER_UPDATE,
    PermissionEnum.EVENT_ORGANIZER_DELETE,
    PermissionEnum.EVENT_ORGANIZER_RESTORE,
    PermissionEnum.EVENT_ORGANIZER_HARD_DELETE
];

/** The narrow `eventOrganizer.*` grant given to `EDITOR`: create only. */
export const EDITOR_EVENT_ORGANIZER_GRANTS: readonly PermissionEnum[] = [
    PermissionEnum.EVENT_ORGANIZER_CREATE
];

/** `(role, permission)` pairs this migration ensures exist. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = [
    ...EVENT_ORGANIZER_FULL_FAMILY.map((permission) => ({
        role: RoleEnum.SUPER_ADMIN,
        permission
    })),
    ...EVENT_ORGANIZER_FULL_FAMILY.map((permission) => ({ role: RoleEnum.ADMIN, permission })),
    ...EDITOR_EVENT_ORGANIZER_GRANTS.map((permission) => ({ role: RoleEnum.EDITOR, permission }))
];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();

    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} event-organizer role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
