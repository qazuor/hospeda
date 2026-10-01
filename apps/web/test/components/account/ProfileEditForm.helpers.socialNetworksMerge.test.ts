/**
 * @file ProfileEditForm.helpers.socialNetworksMerge.test.ts
 * @description HOS-1262 — `users.socialNetworks` is a MERGED JSONB column, so the
 * patch this form builds is a delta of the CHANGED networks, and a cleared
 * network is an explicit `null`.
 *
 * Before the merge the form rebuilt the whole block and signalled a clear by
 * OMITTING the key. Under `||` an omitted key means "keep the stored value", so
 * that same omission would turn "delete my Instagram" into a save that silently
 * does nothing. `SocialNetworkSchema` accepts `null` per key for this reason;
 * `''` fails its URL regex.
 */

import { describe, expect, it } from 'vitest';
import type { ProfileEditUser } from '../../../src/components/account/ProfileEditForm.client';
import {
    buildInitialProfileSnapshot,
    buildProfilePatch,
    type ProfileSnapshot
} from '../../../src/components/account/ProfileEditForm.helpers';

/** A user with three networks stored. */
const USER: ProfileEditUser = {
    id: 'user-1',
    displayName: 'María García',
    firstName: 'María',
    lastName: 'García',
    facebookUrl: 'https://facebook.com/maria',
    instagramUrl: 'https://instagram.com/maria',
    linkedinUrl: 'https://linkedin.com/in/maria'
};

/** Baseline from the fixture, plus the caller's edits applied on top. */
function patchAfterEditing(edits: Partial<ProfileSnapshot>): Record<string, unknown> {
    const baseline = buildInitialProfileSnapshot(USER);
    return buildProfilePatch({ current: { ...baseline, ...edits }, baseline }).payload;
}

describe('buildProfilePatch — `socialNetworks` is a DELTA', () => {
    it('sends ONLY the edited network, so the merge keeps the other stored ones', () => {
        const payload = patchAfterEditing({ instagramUrl: 'https://instagram.com/maria2' });

        expect(payload.socialNetworks).toStrictEqual({ instagram: 'https://instagram.com/maria2' });
    });

    it('omits `socialNetworks` entirely when no network changed', () => {
        const payload = patchAfterEditing({ displayName: 'María G.' });

        expect(payload).not.toHaveProperty('socialNetworks');
    });

    it('maps the flat form names onto the schema keys (`linkedinUrl` -> `linkedIn`)', () => {
        const payload = patchAfterEditing({ linkedinUrl: 'https://linkedin.com/in/maria2' });

        expect(payload.socialNetworks).toStrictEqual({
            linkedIn: 'https://linkedin.com/in/maria2'
        });
    });
});

describe('buildProfilePatch — a cleared network is an explicit null', () => {
    it('sends `facebook: null` for an emptied field rather than omitting it', () => {
        const payload = patchAfterEditing({ facebookUrl: '' });

        expect(payload.socialNetworks).toStrictEqual({ facebook: null });
    });

    it('treats whitespace-only input as cleared', () => {
        const payload = patchAfterEditing({ facebookUrl: '   ' });

        expect(payload.socialNetworks).toStrictEqual({ facebook: null });
    });

    it('clears one network and edits another in the same save', () => {
        const payload = patchAfterEditing({
            facebookUrl: '',
            instagramUrl: 'https://instagram.com/maria2'
        });

        expect(payload.socialNetworks).toStrictEqual({
            facebook: null,
            instagram: 'https://instagram.com/maria2'
        });
    });
});
