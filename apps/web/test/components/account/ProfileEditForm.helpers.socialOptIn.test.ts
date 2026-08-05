/**
 * @file ProfileEditForm.helpers.socialOptIn.test.ts
 * @description HOS-375 §6.7 (G-5) — the diff/patch half of the social opt-in.
 *
 * The component tests cover what the user sees; this covers the contract with
 * the API. The toggle travels under `settings`, which the protected PATCH
 * validates against a STRICT web-scoped allowlist
 * (`UserSettingsWebPatchSchema`, `apps/api/src/routes/user/protected/patch.ts`).
 * Sending it anywhere else, or under any other key name, is a 400.
 *
 * So the payload this form produces is asserted against that real schema rather
 * than against a hand-written expectation of it — a local copy could drift from
 * the validator and still pass.
 *
 * ## The payload is a DELTA, and that is only safe because the API MERGES
 *
 * `settings` is a JSONB column holding the user's whole preference tree —
 * `themeWeb`, `languageWeb`, `notifications`, `newsletter`,
 * `searchHistoryEnabled` and the entire `onboarding` subtree. This form owns
 * exactly ONE key of it and sends exactly that key, which is the only
 * non-destructive shape available to it: the strict web allowlist forbids
 * echoing back keys it does not own, and re-sending a locally reconstructed
 * tree would clobber whatever the client did not know about.
 *
 * The other half of that contract is server-side: the PATCH must MERGE this
 * delta into the stored JSONB, never replace it. `UserModel` declares `settings`
 * in `mergeableJsonbColumns` (`packages/db/src/models/user/user.model.ts`) so
 * the DB shallow-merges the delta. Until it did, ticking this one checkbox wiped
 * every other preference — see `packages/db/test/models/user.model.settings-merge.test.ts`,
 * which is what holds that half up.
 *
 * The assertions below therefore pin the delta shape DELIBERATELY: if someone
 * ever "fixes" a wipe by making the form send a full settings object, they have
 * moved the destruction into the client instead of removing it, and these turn red.
 */

import { UserSettingsWebPatchSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { ProfileEditUser } from '../../../src/components/account/ProfileEditForm.client';
import {
    buildInitialProfileSnapshot,
    buildProfilePatch,
    type ProfileSnapshot
} from '../../../src/components/account/ProfileEditForm.helpers';

const BASE_USER: ProfileEditUser = {
    id: 'user-1',
    displayName: 'María García',
    firstName: 'María',
    lastName: 'García'
};

/** Snapshot pair differing only in the opt-in. */
function snapshots({ from, to }: { readonly from: boolean; readonly to: boolean }): {
    readonly baseline: ProfileSnapshot;
    readonly current: ProfileSnapshot;
} {
    const baseline = buildInitialProfileSnapshot({
        ...BASE_USER,
        publicProfileShowSocialNetworks: from
    });
    return { baseline, current: { ...baseline, publicProfileShowSocialNetworks: to } };
}

describe('buildInitialProfileSnapshot — social opt-in default', () => {
    it('defaults to false when the user has no stored value', () => {
        expect(buildInitialProfileSnapshot(BASE_USER).publicProfileShowSocialNetworks).toBe(false);
    });

    it('defaults to false when the stored value is null', () => {
        // Drizzle returns `null` for an empty `settings` JSONB.
        expect(
            buildInitialProfileSnapshot({
                ...BASE_USER,
                publicProfileShowSocialNetworks: null
            }).publicProfileShowSocialNetworks
        ).toBe(false);
    });

    it('carries a stored true through', () => {
        // Non-vacuity guard for the two above.
        expect(
            buildInitialProfileSnapshot({
                ...BASE_USER,
                publicProfileShowSocialNetworks: true
            }).publicProfileShowSocialNetworks
        ).toBe(true);
    });
});

describe('buildProfilePatch — social opt-in', () => {
    it('emits the opt-in under settings', () => {
        const { current, baseline } = snapshots({ from: false, to: true });

        expect(buildProfilePatch({ current, baseline }).payload.settings).toEqual({
            publicProfileShowSocialNetworks: true
        });
    });

    it('emits the opt-OUT as well, so consent can be withdrawn', () => {
        const { current, baseline } = snapshots({ from: true, to: false });

        expect(buildProfilePatch({ current, baseline }).payload.settings).toEqual({
            publicProfileShowSocialNetworks: false
        });
    });

    it('omits settings entirely when the toggle did not move', () => {
        const { current, baseline } = snapshots({ from: true, to: true });

        expect(buildProfilePatch({ current, baseline }).payload).not.toHaveProperty('settings');
    });

    it('keeps the toggle out of the flat validation map', () => {
        // `flatChanged` is parsed by `ProfileEditFormSchema`, which is strict.
        // A boolean it does not declare would fail validation and block the
        // save with no field to point at.
        const { current, baseline } = snapshots({ from: false, to: true });

        expect(buildProfilePatch({ current, baseline }).flatChanged).not.toHaveProperty(
            'publicProfileShowSocialNetworks'
        );
    });

    it('sends ONLY the key it owns, never a reconstructed settings tree', () => {
        // The non-destructive shape. The form has no knowledge of `themeWeb`,
        // `notifications`, `onboarding` and the rest, so the only way it can
        // avoid clobbering them is to not mention them — and to rely on the API
        // merging the delta. Sending a rebuilt object here would destroy every
        // preference the client never loaded.
        const { current, baseline } = snapshots({ from: false, to: true });

        const settings = buildProfilePatch({ current, baseline }).payload.settings as Record<
            string,
            unknown
        >;

        expect(Object.keys(settings)).toEqual(['publicProfileShowSocialNetworks']);
        for (const foreign of [
            'themeWeb',
            'languageWeb',
            'notifications',
            'newsletter',
            'searchHistoryEnabled',
            'onboarding'
        ]) {
            expect(settings).not.toHaveProperty(foreign);
        }
    });

    it('does not put the toggle inside the socialNetworks JSONB', () => {
        // It is a preference ABOUT the block, not a member of it. The JSONB
        // shape would reject it.
        const { current, baseline } = snapshots({ from: false, to: true });
        const { payload } = buildProfilePatch({ current, baseline });

        expect(payload.socialNetworks ?? {}).not.toHaveProperty('publicProfileShowSocialNetworks');
    });
});

describe('the emitted settings payload survives the API validator', () => {
    // The seam the task calls "round-trips through a PATCH (not a 400)".
    // `UserSettingsWebPatchSchema` is strict, so this fails on a renamed key,
    // a wrong type, or a stray companion field.
    it.each([true, false])('parses with the opt-in set to %s', (value) => {
        const { current, baseline } = snapshots({ from: !value, to: value });
        const { payload } = buildProfilePatch({ current, baseline });

        const result = UserSettingsWebPatchSchema.safeParse(payload.settings);

        expect(result.success ? [] : result.error.issues).toEqual([]);
    });

    it('rejects the same value under a misspelt key — proving the check bites', () => {
        // Non-vacuity: without this, a permissive schema would make the two
        // cases above pass no matter what the form sent.
        const result = UserSettingsWebPatchSchema.safeParse({
            publicProfileShowSocialNetwork: true
        });

        expect(result.success).toBe(false);
    });
});
