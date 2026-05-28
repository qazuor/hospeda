/**
 * @file account-data.test.ts
 * @description Source-based tests for the GDPR placeholder page created in
 * SPEC-156 PR-2 (T-017). Verifies the page surfaces a coming-soon notice
 * and links users to the support inbox while the data-management tooling
 * is being built.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dataSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/account/data.tsx'),
    'utf8'
);

describe('account/data.tsx (T-017)', () => {
    it('registers the new route path', () => {
        expect(dataSrc).toContain("createFileRoute('/_authed/account/data')");
    });

    it('renders the coming-soon disclosure', () => {
        expect(dataSrc).toContain("t('admin-pages.data.comingSoon.title')");
        expect(dataSrc).toContain("t('admin-pages.data.comingSoon.description')");
    });

    it('exposes a working mailto link to support', () => {
        expect(dataSrc).toContain('mailto:${supportEmail}');
        expect(dataSrc).toContain("t('admin-pages.data.supportContact.email')");
    });
});
