/**
 * @file ProfileEditForm.helpers.contactInfoMerge.test.ts
 * @description HOS-375 — the `contactInfo` JSONB patch this form produces must
 * not be able to delete the eight keys it does not model.
 *
 * ## The bug this pins
 *
 * `users.contactInfo` is ONE JSONB column holding NINE keys: `personalEmail`,
 * `workEmail`, `homePhone`, `workPhone`, `mobilePhone`, `whatsapp`, `website`,
 * `preferredEmail` and `preferredPhone`.
 *
 * This form models exactly ONE of them — `mobilePhone`, surfaced as the flat
 * `phone` field. It used to send `{ mobilePhone: phone }` as the whole column
 * value, so while the API replaced the column, saving a phone number deleted the
 * other eight keys. That is not theoretical: `contactInfo.website` is a LIVE
 * read fallback for the profile website field on this very page
 * (`pages/[lang]/mi-cuenta/editar/index.astro`), so a phone save destroyed a
 * value the next page load tried to display.
 *
 * ## The two halves of the fix, and why both are asserted here
 *
 * Server-side, `UserModel` declares `contactInfo` in `mergeableJsonbColumns`, so
 * the DB shallow-merges this patch instead of replacing the column
 * (`packages/db/test/models/user.model.settings-merge.test.ts` and the
 * integration twin hold that half up).
 *
 * Client-side, merge semantics invert how a field is CLEARED: an omitted key now
 * means "leave it as it was", so an emptied phone must travel as an explicit
 * `null`. Omitting it — which is what this file used to do, behind an
 * `if (phone.length > 0)` guard — would trade a wipe bug for a permanently
 * un-clearable phone number.
 *
 * The assertions below pin BOTH directions deliberately.
 */

import { describe, expect, it } from 'vitest';
import type { ProfileEditUser } from '../../../src/components/account/ProfileEditForm.client';
import {
    buildInitialProfileSnapshot,
    buildProfilePatch,
    type ProfileSnapshot
} from '../../../src/components/account/ProfileEditForm.helpers';

/**
 * A user with a stored phone. The eight sibling contact keys are deliberately
 * ABSENT from this fixture — that asymmetry is the whole point: the form's
 * snapshot has no field for them, so a test cannot assert on them directly.
 * What it CAN assert is that the emitted patch never names them, which is the
 * property that keeps the merge safe.
 */
const USER_WITH_PHONE: ProfileEditUser = {
    id: 'user-1',
    displayName: 'María García',
    firstName: 'María',
    lastName: 'García',
    phone: '+541112345678'
};

/** Baseline from the fixture, plus the caller's edits applied on top. */
function patchAfterEditing(edits: Partial<ProfileSnapshot>): Record<string, unknown> {
    const baseline = buildInitialProfileSnapshot(USER_WITH_PHONE);
    const current: ProfileSnapshot = { ...baseline, ...edits };
    return buildProfilePatch({ current, baseline }).payload;
}

describe('buildProfilePatch — `contactInfo` is a DELTA, never a whole-block rebuild', () => {
    it('sends ONLY `mobilePhone` when the phone is edited', () => {
        const payload = patchAfterEditing({ phone: '+541198765432' });

        expect(payload.contactInfo).toEqual({ mobilePhone: '+541198765432' });
    });

    it('never names a contact key this form does not model', () => {
        // The invariant behind the case above: any key present in this patch is
        // a key this form would overwrite in the merged column. `website` is the
        // one that actually bit — this page reads it back as the profile website
        // fallback.
        const payload = patchAfterEditing({ phone: '+541198765432' });

        expect(Object.keys(payload.contactInfo as object)).toEqual(['mobilePhone']);
    });

    it('omits `contactInfo` entirely when the phone did not change', () => {
        // A patch key that is present but unchanged would still take the merge
        // path server-side for no reason; absence is the correct signal.
        const payload = patchAfterEditing({ displayName: 'María G.' });

        expect(payload).not.toHaveProperty('contactInfo');
    });

    it('does not confuse the `profile` block with the `contactInfo` block', () => {
        // Both are now merge-mode deltas built in the same function. `website`
        // exists as a key on BOTH columns, so a copy-paste slip would be easy
        // and silent: the profile edit must never leak into contactInfo.
        const payload = patchAfterEditing({ website: 'https://nuevo.example.com' });

        expect(payload).not.toHaveProperty('contactInfo');
        expect(payload.profile).toEqual({ website: 'https://nuevo.example.com' });
    });
});

describe('buildProfilePatch — an emptied phone is an explicit null', () => {
    it('sends `mobilePhone: null` for a cleared phone rather than omitting it', () => {
        // The regression the old `if (phone.length > 0)` guard would reintroduce:
        // under merge semantics an omitted key means "keep the old value", so
        // omitting a cleared phone is a save that silently does nothing.
        const payload = patchAfterEditing({ phone: '' });

        expect(payload.contactInfo).toEqual({ mobilePhone: null });
    });

    it('treats a whitespace-only phone as cleared', () => {
        const payload = patchAfterEditing({ phone: '   ' });

        expect(payload.contactInfo).toEqual({ mobilePhone: null });
    });

    it('clears the phone WITHOUT touching the profile block', () => {
        // Non-vacuity partner: the clear must be scoped to the one key, not
        // expressed as a broad "null out everything I know about" patch.
        const payload = patchAfterEditing({ phone: '' });

        expect(payload.contactInfo).toEqual({ mobilePhone: null });
        expect(payload).not.toHaveProperty('profile');
    });
});

describe('buildProfilePatch — the flat validation subset is unchanged', () => {
    it('still reports a cleared phone as an empty string, not as null', () => {
        // `flatChanged` feeds `ProfileEditFormSchema` (a FORM schema over
        // strings), whose `phone` rule is `z.union([z.literal(''), regex])`.
        // Leaking the API's null into it would make the empty-string branch
        // unreachable and 400 a legitimate clear.
        const baseline = buildInitialProfileSnapshot(USER_WITH_PHONE);
        const current: ProfileSnapshot = { ...baseline, phone: '' };

        const { flatChanged } = buildProfilePatch({ current, baseline });

        expect(flatChanged.phone).toBe('');
    });

    it('still reports an edited phone as its plain string value', () => {
        const baseline = buildInitialProfileSnapshot(USER_WITH_PHONE);
        const current: ProfileSnapshot = { ...baseline, phone: '+541198765432' };

        const { flatChanged } = buildProfilePatch({ current, baseline });

        expect(flatChanged).toEqual({ phone: '+541198765432' });
    });
});
