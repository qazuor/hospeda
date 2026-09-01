/**
 * @fileoverview
 * Data migration: 0072-hos-765-billing-reconciliation-permission
 *
 * Companion delta for HOS-765. The seed's `ROLE_PERMISSIONS` constant
 * (`packages/seed/src/required/rolePermissions.seed.ts`) has already been edited
 * so a fresh `db:fresh`/`db:fresh-dev` grants `BILLING_RECONCILIATION_MANAGE` —
 * this migration is the delta for environments that already seeded without it
 * (staging/prod), per the HOS-25 seed dual-write rule.
 *
 * Editing only the baseline would be the usual silent bug in its most annoying
 * form: fresh databases would show the "Conciliación" screen while staging and
 * prod hid it from EVERYONE — including the SUPER_ADMIN who is the only person
 * meant to have it — so the tool built to rescue a production incident would be
 * unreachable in production.
 *
 * ## Ordering against the structural migration
 *
 * `permission` is a POSTGRES ENUM (`permission_enum`, generated from
 * `PermissionEnum` by `packages/db/src/schemas/enums.dbschema.ts`). This
 * migration inserts a row whose `permission` value does not exist in that type
 * until the accompanying structural migration has run, so against a live
 * database it MUST follow it. That is the documented run order —
 * `db:migrate` -> `db:apply-extras` -> `db:seed:migrate` — and the run order that
 * satisfies this direction: a data change that needs something the schema carril
 * ADDS. Running it first fails loudly with
 * `invalid input value for enum permission_enum` rather than silently, which is
 * the shape we want.
 *
 * ## Who receives it, and who deliberately does not
 *
 * `SUPER_ADMIN` alone. Not a conservative default that someone should widen
 * later — the grant opens two verbs that write money into `billing_payments` and
 * bind a real payer's MercadoPago charge to a named person's subscription. The
 * precedent is already set: SPEC-164 revoked EVERY billing permission from
 * `ADMIN` (19 of them) precisely so billing writes need the top role, and
 * HOS-765 asked for a permission of its own rather than an existing one for the
 * same reason.
 *
 * `ADMIN` is therefore excluded on purpose, and so is every other role. If the
 * owner later wants a billing-operations role that is not SUPER_ADMIN, that is a
 * deliberate decision to make once — and it should be made by adding a grant
 * here, visibly, not by quietly attaching the verb to a permission that already
 * travels widely.
 *
 * ## `destructive` flag decision
 *
 * `false` — this only ever ADDS a grant (`INSERT ... ON CONFLICT DO NOTHING`).
 * It never deletes or narrows access, so the production destructive-migration
 * gate does not apply.
 */
import { rolePermission } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0072-hos-765-billing-reconciliation-permission',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The single HOS-765 permission this migration hands out.
 *
 * Exported so the migration's own test can assert it against the seed's
 * `ROLE_PERMISSIONS` directly. A test that re-declared the value locally would
 * compare its own copy to the seed and stay green while THIS constant drifted.
 */
export const RECONCILIATION_PERMISSION = PermissionEnum.BILLING_RECONCILIATION_MANAGE;

/** The roles that receive it. See the file header for why the list is this short. */
export const GRANTED_ROLES: readonly RoleEnum[] = [RoleEnum.SUPER_ADMIN];

/** `(role, permission)` pairs this migration ensures exist. */
export const GRANTS: Array<{ role: RoleEnum; permission: PermissionEnum }> = GRANTED_ROLES.map(
    (role) => ({ role, permission: RECONCILIATION_PERMISSION })
);

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values(GRANTS)
        .onConflictDoNothing()
        .returning();

    return {
        summary: `Granted ${inserted.length} of ${GRANTS.length} billing-reconciliation role_permission row(s) (rest already present).`,
        counts: { granted: inserted.length, alreadyPresent: GRANTS.length - inserted.length }
    };
}
