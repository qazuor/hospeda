import type { User } from '@repo/schemas';

/**
 * Ready sentinel for the admin welcome-tour gate.
 *
 * The welcome-tour gate compares `stored >= tours['host.welcome'].version`
 * (catalog at `apps/admin/src/config/ia/tours.ts`, currently version 1).
 * Writing a large sentinel marks the tour permanently seen regardless of future
 * version bumps, so this dev/test helper never goes stale.
 *
 * This is intentionally NOT the "real" prod version — it is a fixture
 * convenience. `packages/seed` cannot import `apps/admin` (app→package is
 * forbidden), hence the sentinel approach.
 */
export const TOUR_READY_SENTINEL = 9999;

/**
 * Minimal port interface so the helper is unit-testable without a live DB.
 * `UserModel` from `@repo/db` satisfies this interface.
 */
export type UserReadyModelPort = {
    findOne(filter: Record<string, unknown>): Promise<User | null>;
    update(where: Record<string, unknown>, data: Partial<User>): Promise<User | null>;
};

/**
 * Input parameters for {@link markUserReady}.
 */
export type MarkUserReadyParams = {
    /** Lookup key — email is the stable handle for the ad-hoc CLI. */
    email: string;
    /**
     * Model port used to locate and update the user row.
     * Accepts any object that satisfies {@link UserReadyModelPort}, including the
     * real `UserModel` from `@repo/db` and in-memory stubs in tests.
     */
    model: UserReadyModelPort;
};

/**
 * Result discriminated union returned by {@link markUserReady}.
 */
export type MarkUserReadyResult = { ok: true; userId: string } | { ok: false; reason: 'not_found' };

/**
 * Make a user "ready" for local dev / testing by writing the real domain state
 * that the onboarding gates read:
 *
 * - `profileCompleted = true` — clears the "complete your profile" redirect on the web app.
 * - `settings.onboarding.adminTours["host.welcome"] = TOUR_READY_SENTINEL` — marks the
 *   admin welcome tour as permanently seen.
 * - `settings.onboarding.whatsNew.baselineAt = <now>` — baselines the what's-new modal
 *   so all currently published entries are treated as seen.
 * - `adminInfo.passwordChangeRequired = false` (only when currently `true`) — clears the
 *   admin forced-change-password gate (read by `/auth/me`). This is what lets a seeded
 *   super admin skip the change-password redirect in local dev.
 *
 * The merge is non-destructive: any pre-existing settings keys (e.g. `theme`, other
 * `adminTours` entries) are preserved via a read-modify-write spread, mirroring the
 * pattern in `UserService.markAdminTourSeen`. `UserModel` does not declare
 * `mergeableJsonbColumns` for `settings`, so the DB-level merge cannot be relied on —
 * the merge MUST be done here before calling `model.update`.
 *
 * `whatsNew.baselineAt` is written with `?? new Date().toISOString()` so that re-running
 * this helper is idempotent: an existing baseline is kept as-is.
 *
 * @param params - Email + model port (see {@link MarkUserReadyParams}).
 * @returns `{ ok: true, userId }` on success, or `{ ok: false, reason: 'not_found' }` when
 *   no user with the given email exists.
 */
export async function markUserReady(params: MarkUserReadyParams): Promise<MarkUserReadyResult> {
    const { email, model } = params;

    const existing = await model.findOne({ email });
    if (!existing) {
        return { ok: false, reason: 'not_found' };
    }

    // Read-modify-write: shallow-cast JSONB to typed settings.
    // `settings` may be null/undefined on a freshly-created row.
    const currentSettings = (existing.settings as Record<string, unknown>) ?? {};

    // Safely navigate the onboarding namespace, preserving all sibling keys.
    const currentOnboarding = (currentSettings.onboarding as Record<string, unknown>) ?? {};
    const currentAdminTours = (currentOnboarding.adminTours as Record<string, number>) ?? {};
    const currentWhatsNew = (currentOnboarding.whatsNew as Record<string, unknown>) ?? {};

    // Deep-merge: update only the target keys, keep every other key intact.
    const mergedSettings: Record<string, unknown> = {
        ...currentSettings,
        onboarding: {
            ...currentOnboarding,
            adminTours: { ...currentAdminTours, 'host.welcome': TOUR_READY_SENTINEL },
            whatsNew: {
                ...currentWhatsNew,
                // Idempotent: preserve an existing baselineAt so re-runs don't move it forward.
                baselineAt: currentWhatsNew.baselineAt ?? new Date().toISOString()
            }
        }
    };

    // The admin change-password gate (apps/api/src/routes/auth/me.ts) reads
    // `adminInfo.passwordChangeRequired` (JSONB), NOT the `mustChangePassword`
    // column. The seeded super admin is created with that flag = `true` (forced
    // first-login change — by design for prod, see superAdminLoader.ts). To make
    // it "ready" in dev we must clear that JSONB flag too; clearing only the
    // `mustChangePassword` column is not enough. Read-modify-write preserves
    // sibling adminInfo keys (notes, favorite). Only touched when the flag is
    // actually set, so users without adminInfo are left untouched.
    const currentAdminInfo = (existing as Record<string, unknown>).adminInfo as
        | Record<string, unknown>
        | null
        | undefined;
    const clearsPasswordChange = currentAdminInfo?.passwordChangeRequired === true;

    // NOTE: `mustChangePassword` is a DB column (must_change_password) that is NOT
    // part of the Zod `User` type. It defaults to `false` for all new users, so
    // writing it here is only relevant for users whose flag was explicitly set to
    // `true` (e.g. commerce owner provisioning). The `unknown` bridge cast is
    // required because TypeScript's excess-property checker would reject a type
    // assertion to `Partial<User>` when the source object contains keys that are
    // absent from `User` (even though the Drizzle `.set()` call below happily
    // accepts them as the DB schema knows about the column).
    const updatePayload = {
        profileCompleted: true,
        mustChangePassword: false,
        settings: mergedSettings,
        ...(clearsPasswordChange
            ? { adminInfo: { ...currentAdminInfo, passwordChangeRequired: false } }
            : {})
    } as unknown as Partial<User>;

    await model.update({ id: existing.id }, updatePayload);

    return { ok: true, userId: existing.id };
}
