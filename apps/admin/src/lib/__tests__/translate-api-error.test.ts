/**
 * Tests for translateAdminApiError — SPEC-183 Phase 3.
 *
 * Verifies the admin-side adapter for `translateApiError`:
 *  (a) key present → returns translation
 *  (b) key absent (sentinel) → falls back to the `fb` argument from translateApiError
 *  (c) priority chain: reason → code → message → fallback → GENERIC
 *  (d) null/undefined error → returns fallback
 */
import { describe, expect, it } from 'vitest';
import { translateAdminApiError } from '../errors/translate-api-error';

/** Simplified admin `t` mock matching (key, params?) signature. */
function makeAdminT(catalog: Record<string, string>) {
    return (key: string, _params?: Record<string, unknown>): string => {
        return catalog[key] ?? `[MISSING: ${key}]`;
    };
}

/** Catalog with common.apiError keys for tests that need real translations. */
const CATALOG_WITH_KNOWN = {
    'common.apiError.NOT_FOUND': 'No encontramos lo que buscabas.',
    'common.apiError.FORBIDDEN': 'No tenés permiso para hacer eso.',
    'common.apiError.GENERIC': 'Algo salió mal. Intentá de nuevo.',
    'common.apiError.NEWSLETTER_NOT_CONFIGURED': 'El newsletter no está configurado.',
    'my.fallback': 'Mi fallback localizado'
};

/** Catalog with no apiError keys — all lookups produce [MISSING:...] sentinel. */
const EMPTY_CATALOG = {
    'my.fallback': 'Mi fallback localizado'
};

describe('translateAdminApiError', () => {
    describe('(a) key present → returns translation', () => {
        it('translates a known code using the catalog', () => {
            const t = makeAdminT(CATALOG_WITH_KNOWN) as Parameters<
                typeof translateAdminApiError
            >[0]['t'];
            const result = translateAdminApiError({
                error: { code: 'NOT_FOUND' },
                t
            });
            expect(result).toBe('No encontramos lo que buscabas.');
        });

        it('translates a known reason, ignoring code', () => {
            const t = makeAdminT(CATALOG_WITH_KNOWN) as Parameters<
                typeof translateAdminApiError
            >[0]['t'];
            const result = translateAdminApiError({
                error: { code: 'SERVICE_UNAVAILABLE', reason: 'NEWSLETTER_NOT_CONFIGURED' },
                t
            });
            expect(result).toBe('El newsletter no está configurado.');
        });
    });

    describe('(b) key absent → falls back to caller fallback', () => {
        it('returns fallback when code has no catalog entry', () => {
            const t = makeAdminT(EMPTY_CATALOG) as Parameters<
                typeof translateAdminApiError
            >[0]['t'];
            const result = translateAdminApiError({
                error: { code: 'UNKNOWN_CODE_XYZ', message: 'English server message' },
                t,
                fallback: 'Mi fallback localizado'
            });
            // No catalog entry for UNKNOWN_CODE_XYZ → falls through to API message
            // because translateApiError uses message as the fb for code lookup
            expect(result).toBe('English server message');
        });

        it('returns caller fallback when code is absent and message is empty', () => {
            const t = makeAdminT(EMPTY_CATALOG) as Parameters<
                typeof translateAdminApiError
            >[0]['t'];
            const result = translateAdminApiError({
                error: { code: undefined, message: undefined },
                t,
                fallback: 'Mi fallback localizado'
            });
            expect(result).toBe('Mi fallback localizado');
        });

        it('does NOT return [MISSING:...] sentinel to the caller', () => {
            const t = makeAdminT(EMPTY_CATALOG) as Parameters<
                typeof translateAdminApiError
            >[0]['t'];
            const result = translateAdminApiError({
                error: { code: 'SOME_UNKNOWN_CODE' },
                t,
                fallback: 'Mi fallback localizado'
            });
            // Even though t returns [MISSING: common.apiError.SOME_UNKNOWN_CODE],
            // the adapter must NOT propagate the sentinel to the UI.
            expect(result).not.toMatch(/\[MISSING:/);
        });
    });

    describe('(c) priority chain: reason → code → message → fallback', () => {
        it('reason takes priority over code', () => {
            const t = makeAdminT(CATALOG_WITH_KNOWN) as Parameters<
                typeof translateAdminApiError
            >[0]['t'];
            const result = translateAdminApiError({
                error: {
                    code: 'FORBIDDEN',
                    reason: 'NEWSLETTER_NOT_CONFIGURED',
                    message: 'English fallback'
                },
                t
            });
            expect(result).toBe('El newsletter no está configurado.');
        });

        it('code takes priority over message when reason is absent', () => {
            const t = makeAdminT(CATALOG_WITH_KNOWN) as Parameters<
                typeof translateAdminApiError
            >[0]['t'];
            const result = translateAdminApiError({
                error: { code: 'FORBIDDEN', message: 'English fallback' },
                t
            });
            expect(result).toBe('No tenés permiso para hacer eso.');
        });

        it('falls through to API message when code has no catalog entry', () => {
            const t = makeAdminT({ 'common.apiError.GENERIC': 'Algo salió mal.' }) as Parameters<
                typeof translateAdminApiError
            >[0]['t'];
            const result = translateAdminApiError({
                error: { code: 'VERY_OBSCURE_CODE', message: 'English server message' },
                t
            });
            expect(result).toBe('English server message');
        });

        it('falls through to GENERIC when code absent and message empty', () => {
            const t = makeAdminT({ 'common.apiError.GENERIC': 'Algo salió mal.' }) as Parameters<
                typeof translateAdminApiError
            >[0]['t'];
            const result = translateAdminApiError({
                error: { code: undefined, message: '' },
                t
            });
            expect(result).toBe('Algo salió mal.');
        });
    });

    describe('(d) null/undefined error', () => {
        it('returns fallback when error is null', () => {
            const t = makeAdminT(CATALOG_WITH_KNOWN) as Parameters<
                typeof translateAdminApiError
            >[0]['t'];
            const result = translateAdminApiError({
                error: null,
                t,
                fallback: 'Mi fallback localizado'
            });
            expect(result).toBe('Mi fallback localizado');
        });

        it('returns fallback when error is undefined', () => {
            const t = makeAdminT(CATALOG_WITH_KNOWN) as Parameters<
                typeof translateAdminApiError
            >[0]['t'];
            const result = translateAdminApiError({
                error: undefined,
                t,
                fallback: 'Mi fallback localizado'
            });
            expect(result).toBe('Mi fallback localizado');
        });

        it('returns GENERIC translation when error is null and no fallback provided', () => {
            const t = makeAdminT(CATALOG_WITH_KNOWN) as Parameters<
                typeof translateAdminApiError
            >[0]['t'];
            const result = translateAdminApiError({ error: null, t });
            expect(result).toBe('Algo salió mal. Intentá de nuevo.');
        });
    });
});
