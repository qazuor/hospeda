/**
 * @file ProfileEditForm.helpers.profileMerge.test.ts
 * @description HOS-375 — the `profile` JSONB patch this form produces must not
 * be able to delete the half of the column it does not model.
 *
 * ## The bug this pins
 *
 * `users.profile` is ONE JSONB column holding `bio`, `avatar`, `website` and
 * `occupation`, and since HOS-375 `bio` + `avatar` decide whether the user's
 * author page is indexed and listed in the sitemap
 * (`UserModel.listPublicAuthors`, `evaluateAuthorIndexability`).
 *
 * This form owns `bio` / `website` / `occupation`. It has NO concept of
 * `avatar` — its avatar upload targets the separate `users.image` COLUMN and
 * travels as a top-level `image`. So while the API replaced the column, an
 * editor who set bio + avatar in the admin and then added a website here lost
 * `avatar`: their author page silently left Google's index with no signal
 * anywhere.
 *
 * ## The two halves of the fix, and why both are asserted here
 *
 * Server-side, `UserModel` declares `profile` in `mergeableJsonbColumns`, so
 * the DB shallow-merges this patch instead of replacing the column
 * (`packages/db/test/models/user.model.settings-merge.test.ts` and the
 * integration twin hold that half up).
 *
 * Client-side, merge semantics invert how a field is CLEARED: an omitted key
 * now means "leave it as it was", so an emptied field must travel as an
 * explicit `null`. Omitting it — which is what this file used to do — would
 * trade a wipe bug for a permanently un-clearable bio.
 *
 * The assertions below pin BOTH directions deliberately. If someone ever
 * "simplifies" this back into a whole-block rebuild, or drops the explicit
 * nulls, one of these turns red.
 */

import { describe, expect, it } from 'vitest';
import type { ProfileEditUser } from '../../../src/components/account/ProfileEditForm.client';
import {
    buildInitialProfileSnapshot,
    buildProfilePatch,
    type ProfileSnapshot
} from '../../../src/components/account/ProfileEditForm.helpers';

/**
 * An author whose page is currently indexable: they have a bio and an avatar,
 * both set from the ADMIN account form, plus a website set here.
 *
 * `avatarUrl` deliberately maps to `users.image`, NOT to `profile.avatar` —
 * that asymmetry is the whole reason this form cannot see the key it used to
 * destroy, so the fixture keeps `profile.avatar` unreachable from the snapshot.
 */
const INDEXABLE_AUTHOR: ProfileEditUser = {
    id: 'user-1',
    displayName: 'María García',
    firstName: 'María',
    lastName: 'García',
    profile: {
        bio: 'Editora de contenidos del litoral argentino.',
        website: 'https://maria.example.com',
        occupation: 'Periodista'
    }
};

/** Baseline from the fixture, plus the caller's edits applied on top. */
function patchAfterEditing(edits: Partial<ProfileSnapshot>): Record<string, unknown> {
    const baseline = buildInitialProfileSnapshot(INDEXABLE_AUTHOR);
    const current: ProfileSnapshot = { ...baseline, ...edits };
    return buildProfilePatch({ current, baseline }).payload;
}

describe('buildProfilePatch — `profile` is a DELTA, never a whole-block rebuild', () => {
    it('sends ONLY the changed key when one field is edited', () => {
        // The regression itself: this payload used to carry `{bio, website,
        // occupation}` rebuilt from the form, which replaced the stored column
        // and took `avatar` with it.
        const payload = patchAfterEditing({ website: 'https://nuevo.example.com' });

        expect(payload.profile).toEqual({ website: 'https://nuevo.example.com' });
    });

    it('never names a key the user did not touch', () => {
        // Belt-and-braces on the case above, stated as the invariant rather
        // than as one expected object: any key present here is a key this form
        // would overwrite in the merged column.
        const payload = patchAfterEditing({ occupation: 'Editora' });

        expect(Object.keys(payload.profile as object)).toEqual(['occupation']);
    });

    it('sends several keys when several changed, and still no others', () => {
        const payload = patchAfterEditing({
            bio: 'Una bio distinta y suficientemente larga.',
            occupation: 'Editora'
        });

        expect(payload.profile).toEqual({
            bio: 'Una bio distinta y suficientemente larga.',
            occupation: 'Editora'
        });
    });

    it('omits `profile` entirely when no profile field changed', () => {
        // A patch key that is present but empty would still take the merge
        // path server-side for no reason; absence is the correct signal.
        const payload = patchAfterEditing({ displayName: 'María G.' });

        expect(payload).not.toHaveProperty('profile');
    });
});

describe('buildProfilePatch — an emptied field is an explicit null', () => {
    it('sends `null` for a cleared website rather than omitting it', () => {
        // Under merge semantics omission means "keep the old value", so an
        // omitted cleared field is a save that silently does nothing.
        const payload = patchAfterEditing({ website: '' });

        expect(payload.profile).toEqual({ website: null });
    });

    it('sends `null` for a cleared bio — the field that gates indexability', () => {
        const payload = patchAfterEditing({ bio: '' });

        expect(payload.profile).toEqual({ bio: null });
    });

    it('sends `null` for a cleared occupation', () => {
        const payload = patchAfterEditing({ occupation: '' });

        expect(payload.profile).toEqual({ occupation: null });
    });

    it('treats a whitespace-only value as cleared', () => {
        const payload = patchAfterEditing({ website: '   ' });

        expect(payload.profile).toEqual({ website: null });
    });

    it('mixes a clear and an edit in one patch', () => {
        const payload = patchAfterEditing({
            website: '',
            bio: 'Bio reescrita con largo suficiente.'
        });

        expect(payload.profile).toEqual({
            bio: 'Bio reescrita con largo suficiente.',
            website: null
        });
    });
});

describe('buildProfilePatch — the flat validation subset is unchanged', () => {
    it('still reports a cleared field as an empty string, not as null', () => {
        // `flatChanged` feeds `ProfileEditFormSchema` (a FORM schema over
        // strings). Leaking the API's null into it would make the empty-string
        // branch of the bio union unreachable and 400 a legitimate clear.
        const baseline = buildInitialProfileSnapshot(INDEXABLE_AUTHOR);
        const current: ProfileSnapshot = { ...baseline, website: '' };

        const { flatChanged } = buildProfilePatch({ current, baseline });

        expect(flatChanged.website).toBe('');
    });

    it('still reports only the fields the user touched', () => {
        const baseline = buildInitialProfileSnapshot(INDEXABLE_AUTHOR);
        const current: ProfileSnapshot = { ...baseline, occupation: 'Editora' };

        const { flatChanged } = buildProfilePatch({ current, baseline });

        expect(flatChanged).toEqual({ occupation: 'Editora' });
    });
});
