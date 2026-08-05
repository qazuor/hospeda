/**
 * @file update.settings-patch.hos375.test.ts
 * @description HOS-375 — a one-key `settings` patch must reach `model.update`
 * as a ONE-KEY object.
 *
 * ## Why this test starts at the SERVICE and not at the model
 *
 * `packages/db/test/models/user.model.settings-merge.test.ts` already proves
 * that `UserModel` merges a partial `settings` patch into the stored JSONB
 * instead of replacing it. It does so by handing `UserModel.update` a one-key
 * patch DIRECTLY — which production never does. Between the HTTP route and the
 * model sits `BaseCrudService.runWithLoggingAndValidation`, which re-parses the
 * body through `UserService.updateSchema` and forwards `validationResult.data`
 * — the PARSED payload — to `model.update`.
 *
 * Zod EXPANDS `.default()` at parse time, and `ZodObject.partial()` does not
 * suppress the defaults declared on an inner object's fields. So before this
 * fix, `{ settings: { publicProfileShowSocialNetworks: true } }` arrived at the
 * model as a fully-populated SEVEN-key object carrying `themeWeb: 'system'`,
 * `languageWeb: 'es'`, `newsletter: false`, … The JSONB merge cannot save that:
 * `stored || patch` faithfully writes every key the patch contains, and the
 * patch contained them all. A user who had picked dark mode, English, and the
 * newsletter lost all three by toggling their social opt-in — and, in the other
 * direction, toggling dark mode reset `publicProfileShowSocialNetworks` to
 * `false`, silently un-publishing the social block on their public author page.
 *
 * A model-level test is structurally blind to that: it never runs the Zod layer
 * that creates the extra keys. Hence these assertions inspect the object
 * `UserService.update` actually hands to `model.update`.
 */
import { UserModel } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import { createActor } from '../../factories/actorFactory';
import { createUser } from '../../factories/userFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';

const asMock = <T>(fn: T) => fn as unknown as Mock;

/** Every `settings` key that carried a `.default()` on `UserSettingsSchema`. */
const DEFAULTED_SETTINGS_KEYS = [
    'themeWeb',
    'themeAdmin',
    'languageWeb',
    'languageAdmin',
    'newsletter',
    'searchHistoryEnabled',
    'publicProfileShowSocialNetworks'
] as const;

describe('UserService.update — `settings` patch reaches the model unexpanded (HOS-375)', () => {
    let service: UserService;
    let userModelMock: UserModel;
    const user = createUser({ id: getMockId('user') as string });
    const actor = createActor({ id: user.id, roles: [RoleEnum.USER], permissions: [] });

    /**
     * Runs a real `UserService.update` with the given `settings` patch and
     * returns the `settings` value that reached `model.update`.
     */
    const captureSettingsSentToModel = async (
        settings: Record<string, unknown>
    ): Promise<Record<string, unknown>> => {
        const result = await service.update(actor, user.id, { settings });
        expect(result.error).toBeUndefined();

        const call = asMock(userModelMock.update).mock.calls[0];
        expect(call).toBeDefined();
        const payload = call?.[1] as { settings?: Record<string, unknown> };
        expect(payload.settings).toBeDefined();
        return payload.settings as Record<string, unknown>;
    };

    beforeEach(() => {
        userModelMock = createTypedModelMock(UserModel, ['findById', 'update']);
        asMock(userModelMock.findById).mockResolvedValue(user);
        asMock(userModelMock.update).mockResolvedValue(user);
        service = createServiceTestInstance(UserService, userModelMock, createLoggerMock());
    });

    it('does not inject the other defaulted keys when only the social opt-in is patched', async () => {
        // Arrange — the exact body the web social toggle sends.
        // Act
        const settings = await captureSettingsSentToModel({
            publicProfileShowSocialNetworks: true
        });

        // Assert — only the key the user touched survives the Zod layer.
        expect(Object.keys(settings)).toEqual(['publicProfileShowSocialNetworks']);
        expect(settings.publicProfileShowSocialNetworks).toBe(true);
        for (const key of DEFAULTED_SETTINGS_KEYS) {
            if (key === 'publicProfileShowSocialNetworks') continue;
            expect(settings).not.toHaveProperty(key);
        }
    });

    it('does not reset the social opt-in when an unrelated key is patched', async () => {
        // Arrange — the exact body `PreferenceToggles.client.tsx` sends on a
        // dark-mode flip.
        // Act
        const settings = await captureSettingsSentToModel({ themeWeb: 'dark' });

        // Assert — the social opt-in must not appear at all; if it did, the
        // JSONB merge would write `false` over the user's stored `true`.
        expect(Object.keys(settings)).toEqual(['themeWeb']);
        expect(settings).not.toHaveProperty('publicProfileShowSocialNetworks');
    });

    it('does not reset the admin theme/locale when the admin settings form patches one key', async () => {
        // Arrange — `apps/admin/src/hooks/use-user-profile.ts` sends a single
        // settings key too.
        // Act
        const settings = await captureSettingsSentToModel({ languageAdmin: 'en' });

        // Assert
        expect(Object.keys(settings)).toEqual(['languageAdmin']);
        for (const key of DEFAULTED_SETTINGS_KEYS) {
            if (key === 'languageAdmin') continue;
            expect(settings).not.toHaveProperty(key);
        }
    });

    it('still forwards every key the caller DID send', async () => {
        // Arrange — a multi-key patch must not be narrowed by the fix.
        // Act
        const settings = await captureSettingsSentToModel({
            themeWeb: 'dark',
            languageWeb: 'en',
            newsletter: true
        });

        // Assert
        expect(settings).toEqual({ themeWeb: 'dark', languageWeb: 'en', newsletter: true });
    });

    it('forwards an explicitly-sent `false` (not treated as absent)', async () => {
        // Arrange — opting OUT is a real write and must survive.
        // Act
        const settings = await captureSettingsSentToModel({
            publicProfileShowSocialNetworks: false
        });

        // Assert
        expect(settings).toEqual({ publicProfileShowSocialNetworks: false });
    });

    it('leaves the nested `onboarding` subtree exactly as sent', async () => {
        // Arrange — nested namespaces must not gain defaults either.
        // Act
        const settings = await captureSettingsSentToModel({
            onboarding: { adminTours: { welcome: 3 } }
        });

        // Assert
        expect(settings).toEqual({ onboarding: { adminTours: { welcome: 3 } } });
    });
});
