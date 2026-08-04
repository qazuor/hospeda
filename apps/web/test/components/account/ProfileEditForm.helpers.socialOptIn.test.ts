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
