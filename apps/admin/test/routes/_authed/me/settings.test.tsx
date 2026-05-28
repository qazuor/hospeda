/**
 * @file /_authed/me/settings redirect test.
 *
 * SPEC-156 PR-2 (T-014). The legacy /me/settings route was split into
 * /mi-cuenta/preferencias (theme + language + timezone) and
 * /mi-cuenta/notificaciones (notification channels). The legacy URL
 * lands on preferences since that is the more general entry point.
 */

import { describe, expect, it, vi } from 'vitest';
import * as mod from '../../../../src/routes/_authed/me/settings';

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

describe('Route /_authed/me/settings', () => {
    it('redirects to /mi-cuenta/preferencias with replace: true', () => {
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
            to: '/mi-cuenta/preferencias',
            replace: true
        });
    });

    it('exposes a no-op fallback component', () => {
        const route = mod.Route as unknown as { component: () => null };

        expect(route.component()).toBeNull();
    });
});
