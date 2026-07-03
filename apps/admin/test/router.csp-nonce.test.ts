/**
 * @file Unit tests for the `getCspNonce` isomorphic pipeline (HOS-33 T-006 —
 * GAP-042-18) consumed by `router.tsx`'s `ssr.nonce`.
 *
 * The actual `getCspNonceOnServer` / `getCspNonceOnClient` implementations
 * live in `src/lib/csp-nonce.ts` rather than inline in `router.tsx` itself:
 * `router.tsx` imports the generated `routeTree.gen.ts`, which in turn pulls
 * in `__root.tsx` and therefore every route file plus module-scope side
 * effects (`validateAdminEnv()`, `initSentry()`, `initPostHog()`). Testing
 * the nonce logic through a dedicated module avoids paying that cost on
 * every run of this suite while still exercising the exact functions
 * `router.tsx` wires into `ssr: { nonce: getCspNonce() } }`.
 *
 * `getCspNonceOnServer` and `getCspNonceOnClient` are tested directly
 * (rather than through the composed `getCspNonce`) because
 * `createIsomorphicFn()`'s untransformed runtime fallback — the one Vitest
 * actually exercises, since it does not run the TanStack Start Vite
 * compiler plugin — always dispatches to whichever `.server()`
 * implementation was registered once one exists, regardless of test
 * environment (verified against the installed `@tanstack/start-fn-stubs`
 * 1.162.0 source, `createIsomorphicFn.ts`). Calling the composed
 * `getCspNonce()` in a Vitest test would therefore always hit the server
 * path, making the client path untestable through it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const globalStartContextMock = vi.fn<() => { cspNonce?: string } | undefined>();

vi.mock('@tanstack/react-start', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tanstack/react-start')>();
    return {
        ...actual,
        getGlobalStartContext: () => globalStartContextMock()
    };
});

import {
    CSP_NONCE_META_SELECTOR,
    getCspNonceOnClient,
    getCspNonceOnServer
} from '../src/lib/csp-nonce';

describe('getCspNonceOnServer (server path — reads getGlobalStartContext())', () => {
    beforeEach(() => {
        globalStartContextMock.mockReset();
    });

    it('returns the cspNonce from the global start context set by cspMiddleware', () => {
        // Arrange
        globalStartContextMock.mockReturnValue({ cspNonce: 'server-nonce-abc123' });

        // Act
        const nonce = getCspNonceOnServer();

        // Assert
        expect(nonce).toBe('server-nonce-abc123');
    });

    it('returns undefined when the context has no cspNonce field', () => {
        // Arrange
        globalStartContextMock.mockReturnValue({});

        // Act & Assert
        expect(getCspNonceOnServer()).toBeUndefined();
    });

    it('returns undefined when getGlobalStartContext() itself returns undefined', () => {
        // Arrange
        globalStartContextMock.mockReturnValue(undefined);

        // Act & Assert
        expect(getCspNonceOnServer()).toBeUndefined();
    });
});

describe('getCspNonceOnClient (client path — reads the csp-nonce meta tag)', () => {
    afterEach(() => {
        document.head.innerHTML = '';
    });

    it('uses the exact "meta[property=csp-nonce]" selector auto-emitted by HeadContent/useTags', () => {
        // Assert — pins the selector to the literal attribute TanStack
        // Router's headContentUtils.tsx pushes: { property: 'csp-nonce' }.
        // This is the tag HeadContent (already rendered in __root.tsx)
        // auto-emits once ssr.nonce is set — no manual meta tag is needed.
        expect(CSP_NONCE_META_SELECTOR).toBe('meta[property="csp-nonce"]');
    });

    it('reads the nonce from the csp-nonce meta tag when present', () => {
        // Arrange
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'csp-nonce');
        meta.setAttribute('content', 'client-nonce-xyz789');
        document.head.appendChild(meta);

        // Act & Assert
        expect(getCspNonceOnClient()).toBe('client-nonce-xyz789');
    });

    it('returns undefined when no csp-nonce meta tag is present', () => {
        // Act & Assert
        expect(getCspNonceOnClient()).toBeUndefined();
    });

    it('ignores unrelated meta tags', () => {
        // Arrange
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'viewport');
        meta.setAttribute('content', 'width=device-width');
        document.head.appendChild(meta);

        // Act & Assert
        expect(getCspNonceOnClient()).toBeUndefined();
    });
});
