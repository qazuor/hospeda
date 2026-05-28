/**
 * @file /_authed/me/change-password redirect test.
 *
 * SPEC-156 PR-2 (T-015). The change-password page was relocated to
 * /mi-cuenta/seguridad/cambiar-password as part of the admin IA
 * reorganization. The legacy URL redirects to the new location.
 */

import { describe, expect, it, vi } from 'vitest';
import * as mod from '../../../../src/routes/_authed/me/change-password';

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

describe('Route /_authed/me/change-password', () => {
    it('redirects to /mi-cuenta/seguridad/cambiar-password with replace: true', () => {
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
            to: '/mi-cuenta/seguridad/cambiar-password',
            replace: true
        });
    });

    it('exposes a no-op fallback component', () => {
        const route = mod.Route as unknown as { component: () => null };

        expect(route.component()).toBeNull();
    });
});
