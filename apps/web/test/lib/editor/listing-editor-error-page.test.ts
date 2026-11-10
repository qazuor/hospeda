/**
 * @file listing-editor-error-page.test.ts
 * @description The editor's fail-closed `503` screen (HOS-1787 leaf 5.1).
 *
 * The API refuses to answer a degraded section map (3.12). The web's half of
 * that decision is this Response: the page renders an error and a retry, never
 * a registry built from a guess.
 */

import { describe, expect, it } from 'vitest';
import { buildListingEditorErrorResponse } from '@/lib/editor/listing-editor-error-page';

describe('buildListingEditorErrorResponse', () => {
    it('answers 503 with a retry and a way back', async () => {
        const response = buildListingEditorErrorResponse({
            locale: 'es',
            retryHref: '/es/mi-cuenta/comercio/venue/abc/editar/datos/',
            backHref: '/es/mi-cuenta/comercio/'
        });
        const body = await response.text();

        expect(response.status).toBe(503);
        expect(body).toContain('/es/mi-cuenta/comercio/venue/abc/editar/datos/');
        expect(body).toContain('/es/mi-cuenta/comercio/');
        expect(body).not.toContain('<script');
    });

    it('does not cache the failure', () => {
        const response = buildListingEditorErrorResponse({
            locale: 'es',
            retryHref: '/es/retry/',
            backHref: '/es/back/'
        });

        expect(response.headers.get('cache-control')).toBe('no-store');
    });
});
