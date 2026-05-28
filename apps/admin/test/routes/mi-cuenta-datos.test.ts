/**
 * @file mi-cuenta-datos.test.ts
 * @description Source-based tests for the GDPR placeholder page created in
 * SPEC-156 PR-2 (T-017). Verifies the page surfaces a coming-soon notice
 * and links users to the support inbox while the data-management tooling
 * is being built.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const datosSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/mi-cuenta/datos.tsx'),
    'utf8'
);

describe('mi-cuenta/datos.tsx (T-017)', () => {
    it('registers the new route path', () => {
        expect(datosSrc).toContain("createFileRoute('/_authed/mi-cuenta/datos')");
    });

    it('renders the coming-soon disclosure', () => {
        expect(datosSrc).toContain("t('admin-pages.datos.comingSoon.title')");
        expect(datosSrc).toContain("t('admin-pages.datos.comingSoon.description')");
    });

    it('exposes a working mailto link to support', () => {
        expect(datosSrc).toContain('mailto:${supportEmail}');
        expect(datosSrc).toContain("t('admin-pages.datos.supportContact.email')");
    });
});
