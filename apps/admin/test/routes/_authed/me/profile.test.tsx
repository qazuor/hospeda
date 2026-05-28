/**
 * @file /_authed/me/profile redirect test.
 *
 * SPEC-156 PR-2 (T-012). The page was relocated to `/mi-cuenta/perfil` as
 * part of the admin IA reorganization; the legacy `/me/profile` URL must
 * redirect to the new location with `replace: true` so back-navigation
 * skips the legacy entry.
 */

import { describe, expect, it, vi } from 'vitest';
import * as mod from '../../../../src/routes/_authed/me/profile';

vi.mock('@tanstack/react-router', () => {
    return {
        createFileRoute:
            (_path: string) =>
            <T extends Record<string, unknown>>(options: T) =>
                options,
        redirect: (options: unknown) => {
            const error = new Error('redirect') as Error & {
                isRedirect: true;
                options: unknown;
            };
            error.isRedirect = true;
            error.options = options;
            return error;
        }
    };
});

describe('Route /_authed/me/profile', () => {
    it('redirects to /mi-cuenta/perfil with replace: true', () => {
        const route = mod.Route as unknown as {
            beforeLoad: () => void;
            component: () => null;
        };

        let thrown: unknown;
        try {
            route.beforeLoad();
        } catch (error) {
            thrown = error;
        }

        const redirectError = thrown as
            | (Error & { isRedirect?: boolean; options?: Record<string, unknown> })
            | undefined;

        expect(redirectError).toBeDefined();
        expect(redirectError?.isRedirect).toBe(true);
        expect(redirectError?.options).toEqual({
            to: '/mi-cuenta/perfil',
            replace: true
        });
    });

    it('exposes a no-op fallback component', () => {
        const route = mod.Route as unknown as { component: () => null };

        expect(route.component()).toBeNull();
    });
});
