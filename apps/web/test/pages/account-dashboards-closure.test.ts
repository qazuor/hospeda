/**
 * @file account-dashboards-closure.test.ts
 * @description AC-1 / AC-13 for the phase-3 dashboards (HOS-2473..2477): each
 * page renders its h1 through ONE kit `PageHeader`, imports none of the §6.3
 * legacy primitives (page and its local dashboard modules), and every help
 * anchor it or its dashboard components use matches HOS-2410's grammar.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isHelpAnchor } from '../../src/components/account/ui/help-anchor';

/** The literal `${vertical}` placeholder the dashboard sources template into anchors. */
const VERTICAL_PLACEHOLDER = ['$', '{vertical}'].join('');

const SRC = resolve(__dirname, '../../src');
const read = (path: string) => readFileSync(resolve(SRC, path), 'utf8');

/** Each dashboard page and the files its markup lives in. */
const CLOSURES: Readonly<Record<string, readonly string[]>> = {
    general: [
        'pages/[lang]/mi-cuenta/index.astro',
        'components/account/dashboard/GeneralDashboardHeader.tsx',
        'components/account/dashboard/GeneralDashboardStats.client.tsx',
        'components/account/dashboard/DashboardLinksSection.tsx'
    ],
    host: [
        'pages/[lang]/mi-cuenta/host-dashboard.astro',
        'components/host/HostDashboard.client.tsx',
        'components/account/dashboard/DashboardLinksSection.tsx'
    ],
    venue: [
        'pages/[lang]/mi-cuenta/tablero-locales.astro',
        'components/account/dashboard/OwnerDashboardPage.astro',
        'components/account/dashboard/OwnerListingDashboard.client.tsx'
    ],
    experience: [
        'pages/[lang]/mi-cuenta/tablero-experiencias.astro',
        'components/account/dashboard/OwnerDashboardPage.astro',
        'components/account/dashboard/OwnerListingDashboard.client.tsx'
    ],
    partner: [
        'pages/[lang]/mi-cuenta/partner/index.astro',
        'components/account/dashboard/PartnerStatsGrid.client.tsx'
    ]
};

/** §6.3 legacy primitives no migrated page may import. */
const LEGACY = [
    'AccountPageHeader',
    'AccountSectionCard',
    'AccountSectionCards',
    'AccountStatsGrid',
    'AccountSection.astro',
    'HostDashboard.module.css'
];

describe.each(Object.entries(CLOSURES))('%s dashboard closure', (_name, files) => {
    const sources = files.map(read);
    const all = sources.join('\n');

    it('renders exactly one PageHeader, and no hand-written h1', () => {
        expect(all.match(/<PageHeader\b/g)).toHaveLength(1);
        expect(all).not.toMatch(/<h1[\s>]/);
    });

    it('imports none of the legacy primitives', () => {
        for (const legacy of LEGACY) expect(all).not.toContain(legacy);
    });

    it('every literal help anchor matches the grammar (vertical templated as venue/experience)', () => {
        const anchors = [...all.matchAll(/section:[A-Za-z0-9.#${}-]+/g)].map((m) => m[0]);
        expect(anchors.length).toBeGreaterThan(0);
        for (const anchor of anchors) {
            for (const vertical of ['venue', 'experience']) {
                const concrete = anchor.replace(VERTICAL_PLACEHOLDER, vertical);
                expect(isHelpAnchor(concrete), concrete).toBe(true);
            }
        }
    });
});
