/**
 * @file /_authed/me/tags redirect test.
 * SPEC-156 PR-2 (T-018). The own-tags page was relocated to
 * /mi-cuenta/etiquetas; the legacy URL redirects with replace history.
 */

import { describe, expect, it, vi } from 'vitest';
import * as mod from '../../../../src/routes/_authed/me/tags';

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

describe('Route /_authed/me/tags', () => {
    it('redirects to /mi-cuenta/etiquetas with replace: true', () => {
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
        expect(redirectError?.isRedirect).toBe(true);
        expect(redirectError?.options).toEqual({
            to: '/mi-cuenta/etiquetas',
            replace: true
        });
    });

    it('exposes a no-op fallback component', () => {
        const route = mod.Route as unknown as { component: () => null };
        expect(route.component()).toBeNull();
    });
});
