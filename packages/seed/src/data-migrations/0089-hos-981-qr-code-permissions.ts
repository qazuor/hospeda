/**
 * @fileoverview
 * Data migration: 0089-hos-981-qr-code-permissions
 *
 * Companion delta for HOS-981. The seed's `ROLE_PERMISSIONS` constant
 * (`packages/seed/src/required/rolePermissions.seed.ts`) has already been edited
 * so a fresh `db:fresh` / `db:fresh-dev` grants the four `platform.qrCode.*`
 * permissions — this migration is the delta for environments that already
 * seeded without them (staging/prod), per the HOS-25 seed dual-write rule.
 *
 * Editing only the baseline would be the usual silent bug in a particularly
 * unhelpful form: fresh databases would show the QR manager while staging and
 * prod hid it from EVERYONE, including the admins who had access to it the day
 * before under `SETTINGS_MANAGE`. The screen would not error — it would simply
 * disappear from the sidebar and 403 at the route.
 *
 * ## Ordering against the structural migration
 *
 * `permission` is a POSTGRES ENUM (`permission_enum`, generated from
 * `PermissionEnum` by `packages/db/src/schemas/enums.dbschema.ts`). This
 * migration inserts rows whose `permission` values do not exist in that type
 * until the accompanying structural migration has run, so against a live
 * database it MUST follow it. That is the documented run order —
 * `db:migrate` → `db:apply-extras` → `db:seed:migrate` — and it is the direction
 * this case needs: a data change that depends on something the schema carril
 * ADDS. Run out of order it fails loudly with
 * `invalid input value for enum permission_enum` rather than silently.
 *
 * ## Who receives them, and why nobody's access changes today
 *
 * `SUPER_ADMIN` and `ADMIN` — exactly the two roles that hold `SETTINGS_MANAGE`,
 * which is the gate the six QR routes shipped behind. The purpose of the split
 * is to make the QR manager DELEGABLE without also handing over SEO defaults,
 * system tags and everything else `SETTINGS_MANAGE` opens. It is deliberately
 * not a change of who can do what: on the day this runs, the same people can do
 * the same things.
 *
 * `SUPER_ADMIN` is listed even though `apps/api/src/utils/actor.ts` short-
 * circuits that role before `role_permission` is ever consulted. The table is
 * the readable record of intent — an auditor counting rows for SUPER_ADMIN gets
 * a false negative from the bypass, not from a gap here — and the baseline seed
 * lists it for every other permission, so omitting it would make this row set
 * look deliberately different when it is not.
 *
 * ## `destructive` flag decision
 *
 * `false` — this only ever ADDS grants (`INSERT ... ON CONFLICT DO NOTHING`).
 * It never deletes or narrows access, so the production destructive-migration
 * gate does not apply. Note in particular that it does NOT revoke
 * `SETTINGS_MANAGE`: that permission gates a great deal besides QR codes, and
 * the routes stopped asking for it in the same release that added these.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0089-hos-981-qr-code-permissions',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The four HOS-981 permissions this migration hands out.
 *
 * Exported so the migration's own test can assert them against the seed's
 * `ROLE_PERMISSIONS` directly. A test that re-declared the values locally would
 * compare its own copy against the seed and stay green while THIS constant
 * drifted.
 */
export const QR_CODE_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.QR_CODE_VIEW,
    PermissionEnum.QR_CODE_CREATE,
    PermissionEnum.QR_CODE_UPDATE,
    PermissionEnum.QR_CODE_DELETE
];

/** The roles that receive them. See the header for why the list is exactly these two. */
export const GRANTED_ROLES: readonly RoleEnum[] = [RoleEnum.SUPER_ADMIN, RoleEnum.ADMIN];

/** `(role, permission)` pairs this migration ensures exist. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = GRANTED_ROLES.flatMap(
    (role) => QR_CODE_PERMISSIONS.map((permission) => ({ role, permission }))
);

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();

    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} QR-code role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
