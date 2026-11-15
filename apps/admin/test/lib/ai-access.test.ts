/**
 * Unit tests for the AI route guards (HOS-2075 adds requireAiConversationsAccess).
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
    redirect: (options: { to: string }) => ({ isRedirect: true, options })
}));

import { requireAiAccess, requireAiConversationsAccess } from '../../src/lib/ai-access';

const ctx = (permissions: readonly string[] | undefined) => ({ permissions });

describe('requireAiConversationsAccess', () => {
    it('passes with AI_CONVERSATION_VIEW_ANY', () => {
        expect(() =>
            requireAiConversationsAccess(ctx([PermissionEnum.AI_CONVERSATION_VIEW_ANY]))
        ).not.toThrow();
    });

    it('redirects to /auth/forbidden with only AI_SETTINGS_MANAGE', () => {
        expect.assertions(1);
        try {
            requireAiConversationsAccess(ctx([PermissionEnum.AI_SETTINGS_MANAGE]));
        } catch (e) {
            expect(e).toMatchObject({ options: { to: '/auth/forbidden' } });
        }
    });

    it('redirects when permissions are missing', () => {
        expect(() => requireAiConversationsAccess(ctx(undefined))).toThrow();
    });
});

describe('requireAiAccess (unchanged)', () => {
    it('rejects AI_CONVERSATION_VIEW_ANY alone', () => {
        expect(() => requireAiAccess(ctx([PermissionEnum.AI_CONVERSATION_VIEW_ANY]))).toThrow();
    });
});
