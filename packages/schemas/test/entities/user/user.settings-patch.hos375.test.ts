/**
 * @file user.settings-patch.hos375.test.ts
 * @description HOS-375 — the UPDATE path's `settings` shape must inject NO
 * defaults, at ANY depth, while the CREATE path keeps every one of them.
 *
 * `stripShapeDefaults` (SPEC-217) removes only TOP-LEVEL defaults, and
 * `settings` itself never carried one — its FIELDS do. So `UserUpdateInputSchema`
 * kept expanding a one-key `settings` patch into the full seven-key object,
 * which the model's JSONB merge then wrote over every sibling. See
 * `UserSettingsPatchSchema`'s JSDoc for the two user-visible failures.
 *
 * The end-to-end proof — that the object handed to `UserModel.update` is the
 * one-key patch the caller sent — lives at the SERVICE layer, in
 * `packages/service-core/test/services/user/update.settings-patch.hos375.test.ts`.
 * That is the layer where the bug was observable; a model-level test never runs
 * the Zod parse that created the extra keys. These cases pin the schema
 * contract that makes it true.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
    UserCreateInputSchema,
    UserUpdateInputSchema
} from '../../../src/entities/user/user.crud.schema.js';
import {
    UserSettingsPatchSchema,
    UserSettingsSchema
} from '../../../src/entities/user/user.settings.schema.js';

/** Every `settings` key that declares a `.default()` on `UserSettingsSchema`. */
const DEFAULTED_SETTINGS_KEYS = [
    'themeWeb',
    'themeAdmin',
    'languageWeb',
    'languageAdmin',
    'newsletter',
    'searchHistoryEnabled',
    'publicProfileShowSocialNetworks'
] as const;

/**
 * Walks a Zod type and returns the dotted path of every `ZodDefault` found, at
 * any depth. Recursing is the point: `.partial()` and a one-level strip both
 * leave nested defaults intact, which is exactly how this bug survived three
 * review rounds.
 *
 * @param node - The Zod type to walk.
 * @param path - Dotted path accumulated so far (internal).
 * @returns Dotted paths of every nested `.default()`.
 */
const findDefaultPaths = (node: z.ZodTypeAny, path = ''): readonly string[] => {
    if (node instanceof z.ZodDefault) {
        return [path || '<root>'];
    }
    if (node instanceof z.ZodOptional || node instanceof z.ZodNullable) {
        return findDefaultPaths(node.unwrap() as unknown as z.ZodTypeAny, path);
    }
    if (node instanceof z.ZodArray) {
        return findDefaultPaths(node.element as unknown as z.ZodTypeAny, `${path}[]`);
    }
    if (node instanceof z.ZodObject) {
        return Object.entries(node.shape as Record<string, z.ZodTypeAny>).flatMap(([key, field]) =>
            findDefaultPaths(field, path ? `${path}.${key}` : key)
        );
    }
    return [];
};

describe('UserSettingsPatchSchema — defaults-free write shape (HOS-375)', () => {
    it('is non-vacuous: the READ schema it derives from really does carry defaults', () => {
        // Arrange / Act
        const defaults = findDefaultPaths(UserSettingsSchema);

        // Assert — if this ever empties out, the assertions below prove nothing.
        expect([...defaults].sort()).toEqual([...DEFAULTED_SETTINGS_KEYS].sort());
    });

    it('carries no default at ANY depth', () => {
        // Arrange / Act
        const defaults = findDefaultPaths(UserSettingsPatchSchema);

        // Assert
        expect(defaults).toEqual([]);
    });

    it('parses an empty settings patch to an empty object', () => {
        // Arrange / Act
        const parsed = UserSettingsPatchSchema.parse({});

        // Assert
        expect(parsed).toEqual({});
    });

    it('keeps every field the caller did send, including an explicit `false`', () => {
        // Arrange
        const input = { themeWeb: 'dark', newsletter: true, searchHistoryEnabled: false } as const;

        // Act
        const parsed = UserSettingsPatchSchema.parse(input);

        // Assert
        expect(parsed).toEqual(input);
    });

    it('still rejects an invalid value (the strip removed defaults, not validation)', () => {
        // Arrange / Act
        const result = UserSettingsPatchSchema.safeParse({ themeWeb: 'neon' });

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('UserUpdateInputSchema — nested settings defaults (HOS-375)', () => {
    it('does not expand a one-key settings patch', () => {
        // Arrange / Act
        const parsed = UserUpdateInputSchema.parse({
            settings: { publicProfileShowSocialNetworks: true }
        }) as { settings: Record<string, unknown> };

        // Assert
        expect(Object.keys(parsed.settings)).toEqual(['publicProfileShowSocialNetworks']);
    });

    it('does not re-inject the social opt-in when an unrelated key is patched', () => {
        // Arrange / Act
        const parsed = UserUpdateInputSchema.parse({ settings: { themeWeb: 'dark' } }) as {
            settings: Record<string, unknown>;
        };

        // Assert
        expect(parsed.settings).not.toHaveProperty('publicProfileShowSocialNetworks');
        expect(Object.keys(parsed.settings)).toEqual(['themeWeb']);
    });

    it('carries no nested settings default at any depth', () => {
        // Arrange / Act
        const defaults = findDefaultPaths(
            UserUpdateInputSchema.shape.settings as unknown as z.ZodTypeAny
        );

        // Assert
        expect(defaults).toEqual([]);
    });
});

describe('UserCreateInputSchema — defaults preserved (HOS-375 non-vacuity partner)', () => {
    it('still populates every settings default when create sends an empty settings object', () => {
        // Arrange / Act
        const parsed = UserCreateInputSchema.parse({
            slug: 'new-user',
            email: 'new-user@example.com',
            displayName: 'New User',
            settings: {}
        }) as { settings: Record<string, unknown> };

        // Assert — the fix must NOT have leaked into the create path.
        expect([...Object.keys(parsed.settings)].sort()).toEqual(
            [...DEFAULTED_SETTINGS_KEYS].sort()
        );
        expect(parsed.settings.themeWeb).toBe('system');
        expect(parsed.settings.languageWeb).toBe('es');
        expect(parsed.settings.newsletter).toBe(false);
        expect(parsed.settings.searchHistoryEnabled).toBe(true);
        expect(parsed.settings.publicProfileShowSocialNetworks).toBe(false);
    });
});
