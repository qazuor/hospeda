/**
 * @file platform-configuration-seo.test.ts
 * @description Source-based tests for the SEO settings page relocated from
 * /settings/seo to /platform/configuration/seo as part of SPEC-156 PR-2
 * (T-020). The localStorage data layer is preserved verbatim; the
 * migration to the platform_settings API with auto-revalidation is
 * deferred to PR-3 (T-030).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const seoSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/platform/configuration/seo.tsx'),
    'utf8'
);

describe('platform/configuration/seo.tsx (T-020)', () => {
    it('registers the new route path', () => {
        expect(seoSrc).toContain("createFileRoute('/_authed/platform/configuration/seo')");
    });

    it('renders the SEO settings page label', () => {
        expect(seoSrc).toContain("'admin-pages.systemSettings.seo");
    });
});
