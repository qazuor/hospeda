/** Shared landing guards: real ancestors only, short labels, intrinsic JSON-LD. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const LANDINGS = [
    'sumate/partner',
    'sumate/proveedor',
    'sumate/sponsor',
    'colaborar/editores'
] as const;

describe('alliance landing breadcrumbs', () => {
    it.each(LANDINGS)('%s uses the shared breadcrumb contract', (page) => {
        const source = readFileSync(
            resolve(__dirname, `../../src/pages/[lang]/${page}/index.astro`),
            'utf8'
        );
        expect(source).toContain(
            "import Breadcrumbs from '@/components/shared/navigation/Breadcrumbs.astro'"
        );
        expect(source).toContain('<Breadcrumbs');
        expect(source).not.toContain('BreadcrumbJsonLd');
    });

    it.each([
        ['partner', 'partners'],
        ['proveedor', 'sumateProvider'],
        ['sponsor', 'sumateSponsor']
    ])('sumate/%s drops the nonexistent grouping level', (page, key) => {
        const source = readFileSync(
            resolve(__dirname, `../../src/pages/[lang]/sumate/${page}/index.astro`),
            'utf8'
        );
        expect(source).toContain(`items={[{ label: breadcrumbLabel({ t, key: '${key}' }) }]}`);
        expect(source).not.toContain('sumate__breadcrumbs');
        expect(source).not.toContain('alliance-leads.breadcrumb.joinUs');
        expect(source).toContain('padding-block: clamp(3rem, 6vw, 4.5rem)');
    });
});
