/**
 * @file directorio-proveedores-detail-page.test.ts
 * @description Source-level regression guard for H-05 on the provider detail
 * page (`[slug]/index.astro`), the sibling of the QR landing page
 * (`[slug]/registrar-uso/index.astro`).
 *
 * Both pages read the SAME `hostTradesApi.getBySlug` call and, before this
 * fix, both had the identical bug: a 403 (host-only gate, `HOST_TRADE_VIEW`)
 * fell into the generic `else { outcome = 'error' }` branch and rendered "No
 * pudimos cargar el proveedor" with a Reintentar button that can never
 * succeed. This file proves the detail page got the same fix.
 *
 * Vitest cannot render `.astro`, so these assertions read the source, same
 * pattern as `registrar-uso-page.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = resolve(
    __dirname,
    '../../src/pages/[lang]/mi-cuenta/directorio-proveedores/[slug]/index.astro'
);
const pageSrc = readFileSync(PAGE_PATH, 'utf8');

describe('directorio-proveedores/[slug] detail page — terminal states', () => {
    it('still tells 404/revoked/other errors apart', () => {
        expect(pageSrc).toContain("outcome = 'revoked'");
        expect(pageSrc).toContain("outcome = 'notFound'");
        expect(pageSrc).toContain("outcome = 'error'");
        expect(pageSrc).toContain('result.error.status === 404');
        expect(pageSrc).toContain("result.error.code === 'PROVIDER_REVOKED'");
    });
});

describe('directorio-proveedores/[slug] detail page — 403 is a gate, not a failure (H-05)', () => {
    const accessDeniedBranch =
        /outcome = 'accessDenied';([\s\S]*?)\n\s*\} else if/.exec(pageSrc)?.[1] ?? '';

    it('branches on the 403 status, distinct from 404/422/other errors', () => {
        expect(pageSrc).toContain('result.error.status === 403');
        expect(pageSrc).toContain("outcome = 'accessDenied'");
    });

    it('does not log an expected 403 as a failure', () => {
        expect(accessDeniedBranch.length).toBeGreaterThan(0);
        expect(accessDeniedBranch).not.toContain('logger.error');
    });

    it('renders the shared host-only gate for a 403, not the generic "could not load" card', () => {
        expect(pageSrc).toContain(
            "import HostTradesAccessDenied from '@/components/host/host-trades/HostTradesAccessDenied.astro'"
        );
        expect(pageSrc).toMatch(/outcome === 'accessDenied' \? \(\s*<HostTradesAccessDenied/);
    });
});
