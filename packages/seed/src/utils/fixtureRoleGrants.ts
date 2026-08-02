import { RoleEnum, RoleGrantReason } from '@repo/schemas';
import { grantRole } from '@repo/service-core';

/**
 * Minimal structural interface of the `grantRole` primitive, as the seed uses
 * it (HOS-296).
 *
 * Injected rather than imported directly at every call site because `grantRole`
 * opens a real database transaction, and the seed's unit tests deliberately run
 * with no database. `vi.mock('@repo/service-core')` is NOT a substitute —
 * module mocking of workspace packages does not reliably intercept inside this
 * package (same note as `pointOfInterestCatalogRelations.test.ts`).
 *
 * This is the canonical declaration; `required/systemUser.seed.ts` re-exports
 * it so there is exactly one definition in the package.
 */
export type GrantRolePort = (params: {
    userId: string;
    role: RoleEnum;
    grantedBy: string | null;
    reason: string;
}) => Promise<{ error?: { message: string } }>;

/**
 * Every value `RoleEnum` admits, as a lookup set for validating the raw string
 * a JSON fixture carries in its `role` field.
 */
const VALID_ROLES: ReadonlySet<string> = new Set<string>(Object.values(RoleEnum));

/**
 * Reads the role a user fixture declares, defaulting to `USER`.
 *
 * `USER` is the default because that is what the dropped `users.role` column
 * declared as its own `DEFAULT` — a fixture with no `role` key used to land on
 * `USER`, and it still must.
 *
 * An unrecognised value throws instead of falling back: a typo in a fixture is
 * a bug that used to be caught by the Postgres enum on insert, and silently
 * degrading it to `USER` would hand a demo host account the wrong capabilities
 * with no signal at all.
 *
 * @param params.item - The raw fixture object as loaded from JSON.
 * @param params.source - Fixture filename or id, used only in the error message.
 * @returns The declared role, or `RoleEnum.USER` when the fixture declares none.
 * @throws {Error} When `role` is present but is not a `RoleEnum` value.
 *
 * @example
 * ```ts
 * resolveFixtureRole({ item: { role: 'HOST' }, source: '007-user-x.json' });
 * // => RoleEnum.HOST
 * ```
 */
export function resolveFixtureRole(params: { item: unknown; source: string }): RoleEnum {
    const { item, source } = params;
    const raw = (item as { role?: unknown } | null)?.role;

    if (raw === undefined || raw === null) {
        return RoleEnum.USER;
    }

    if (typeof raw !== 'string' || !VALID_ROLES.has(raw)) {
        throw new Error(
            `Fixture "${source}" declares an unknown role ${JSON.stringify(raw)}. Valid roles: ${Object.values(RoleEnum).join(', ')}.`
        );
    }

    return raw as RoleEnum;
}

/**
 * Extracts the created entity's id from whatever `createSeedFactory` handed to
 * `postProcess`.
 *
 * The factory passes its `ServiceResult` (`{ data: { id } }`) through
 * `transformResult` when one is configured, so this reads defensively rather
 * than casting.
 *
 * @param result - The factory's post-create result object.
 * @returns The id, or `null` when the shape does not carry one.
 */
function extractCreatedId(result: unknown): string | null {
    const id = (result as { data?: { id?: unknown } } | null)?.data?.id;
    return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Grants a freshly-seeded user fixture the hat its JSON declares (HOS-296).
 *
 * **Why this exists at all**: `role` used to be a plain column on `users`, so a
 * fixture's `"role": "HOST"` reached the database as part of the normal insert.
 * The column is gone, and BOTH layers in front of it now discard the key in
 * silence — Zod object schemas strip unknown keys, and Drizzle's `.values()`
 * iterates the TABLE's columns rather than the object's keys. Without this
 * post-create grant the fixtures still parse, still insert, still log
 * `"(HOST)"`, and produce accounts holding **zero** roles and therefore zero
 * permissions.
 *
 * The fixture receives `{USER, declaredRole}` — the baseline hat plus whatever
 * the JSON declares. That is the set EVERY account-creating path now produces
 * (Better Auth's signup hook, `user/admin/create.ts`, `signup-as-host.ts`, the
 * login fixtures in `test-users/testUsers.seed.ts` and
 * `example/gastronomies.seed.ts`) and the set migration `0069` backfills onto
 * existing rows, so a fresh database and a migrated one converge. Granting the
 * declared role alone would leave every fixture holding a single hat, which is
 * the shape that makes `revokeRole`'s last-role guard reject any revoke and
 * `shouldRevokeHostHat` refuse to demote anybody.
 *
 * A fixture declaring `USER` collapses to one grant — `grantRole` is idempotent
 * and the `(user_id, role)` primary key de-duplicates anyway.
 *
 * @param params.result - The `createSeedFactory` post-create result (`{ data: { id } }`).
 * @param params.item - The raw fixture object, carrying the declared `role`.
 * @param params.source - Fixture identifier for error messages.
 * @param params.grant - Optional `grantRole` override for tests.
 * @returns The declared role, or `null` when the result carried no id.
 * @throws {Error} When the fixture's role is invalid, or a grant fails.
 *
 * @example
 * ```ts
 * postProcess: async (result, item) =>
 *     void (await grantFixtureRole({ result, item, source: 'Users' }));
 * ```
 */
export async function grantFixtureRole(params: {
    result: unknown;
    item: unknown;
    source: string;
    grant?: GrantRolePort;
}): Promise<RoleEnum | null> {
    const { result, item, source, grant } = params;

    const userId = extractCreatedId(result);
    if (!userId) {
        return null;
    }

    const role = resolveFixtureRole({ item, source });
    const grantFn: GrantRolePort = grant ?? (grantRole as unknown as GrantRolePort);

    // Baseline first, so the set is never momentarily single-hatted.
    const rolesToGrant = Array.from(new Set<RoleEnum>([RoleEnum.USER, role]));

    for (const roleToGrant of rolesToGrant) {
        const granted = await grantFn({
            userId,
            role: roleToGrant,
            grantedBy: null,
            reason: RoleGrantReason.SEED
        });

        if (granted.error) {
            throw new Error(
                `Failed to grant ${roleToGrant} to fixture "${source}": ${granted.error.message}`
            );
        }
    }

    return role;
}
