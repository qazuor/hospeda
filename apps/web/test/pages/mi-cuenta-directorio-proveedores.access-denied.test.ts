/**
 * @file mi-cuenta-directorio-proveedores.access-denied.test.ts
 * @description Regression guard for the access-denied state of the host-trades
 * directory (HOS-376 §4 NG-5 / §5 hallazgo 3).
 *
 * The directory is a CAPTATION HOOK: it is free for every host and deliberately
 * NOT gated by a paid plan (owner decision, 2026-08-08). The backend has no
 * billing gate — `GET /protected/host-trades` only requires
 * `PermissionEnum.HOST_TRADE_VIEW`, and the `HOST` role is granted
 * unconditionally when a user creates their onboarding draft accommodation.
 *
 * The copy used to promise "necesitás un plan de anfitrión activo" and sent the
 * user to the subscription page. That promised a requirement the code never
 * enforced, and it aimed the pitch at the one person we most want to convert —
 * the access-denied state is reached ONLY by users who are not hosts yet, since
 * a host without a plan is never denied.
 *
 * H-05 (August 2026 smoke) extracted the actual card into a shared component,
 * `HostTradesAccessDenied.astro`, reused by this page, the QR landing page, and
 * the provider detail page — so the copy/CTA content assertions now live with
 * that component (`test/components/host/host-trades/HostTradesAccessDenied.test.ts`).
 * This file keeps only the WIRING assertion: this page must render the shared
 * component for its 403 branch, not a local re-declaration of it.
 *
 * Astro pages cannot be rendered in Vitest, so the page itself is asserted at
 * source level (same pattern as `mi-cuenta-addons.astro.test.ts`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = '../../src/pages/[lang]/mi-cuenta/directorio-proveedores/index.astro';
const source = readFileSync(resolve(__dirname, PAGE_PATH), 'utf8');

describe('directorio-proveedores access-denied state (HOS-376 NG-5, H-05)', () => {
    it('renders the shared host-only gate for the 403 branch', () => {
        expect(source).toContain(
            "import HostTradesAccessDenied from '@/components/host/host-trades/HostTradesAccessDenied.astro'"
        );
        expect(source).toMatch(
            /accessDenied \? \(\s*\/\*[\s\S]*?\*\/\s*<HostTradesAccessDenied locale=\{locale\} \/>/
        );
    });

    it('does not re-declare the access-denied copy or CTA locally', () => {
        // These would be a copy-paste regression: the whole point of H-05's
        // extraction is that this content has exactly one definition.
        expect(source).not.toContain('accessDeniedTitle');
        expect(source).not.toContain('accessDeniedMessage');
        expect(source).not.toContain('accessDeniedCta');
        expect(source).not.toContain("t('host-trades.accessDenied.");
        // The old hardcoded pricing link must not come back either.
        expect(source).not.toContain('/suscripcion');
    });

    it('flags the 403 without treating it as a fetch failure', () => {
        expect(source).toContain('accessDenied = true');
        expect(source).toContain('tradesResponse.status === 403');
        expect(source).toContain('logger.warn');
    });
});
