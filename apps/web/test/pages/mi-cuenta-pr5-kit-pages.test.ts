/**
 * @file mi-cuenta-pr5-kit-pages.test.ts
 * @description HOS-2414 PR-5 (HOS-2483 / HOS-2484 / HOS-2485): AC-1 for the
 * properties, venue/experience, subscription and add-ons pages (one kit
 * `PageHeader`, none of the §6.3 legacy primitives in the page closure), AC-8
 * (the «Complementos» sidebar item, the add-ons page highlighting it, the
 * «Plan / Complementos» `NavTabs`) and AC-13 (every help anchor in the
 * closure matches HOS-2410's grammar).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isHelpAnchor } from '../../src/components/account/ui/help-anchor';
import { ACCOUNT_NAV_GROUPS } from '../../src/config/navigation';
import { getActiveSectionKey } from '../../src/lib/account-nav-section';

const SRC = resolve(__dirname, '../../src');
const read = (path: string) => readFileSync(resolve(SRC, path), 'utf8');

/** Each page and the files its markup lives in. */
const CLOSURES: Readonly<Record<string, readonly string[]>> = {
    propiedades: [
        'pages/[lang]/mi-cuenta/propiedades/index.astro',
        'components/host/PropertyCard.astro',
        'components/account/OwnerListingCard.astro',
        'components/account/OwnerListingsByState.astro',
        'components/host/PropertyCardMenu.client.tsx'
    ],
    comercio: [
        'pages/[lang]/mi-cuenta/comercio/index.astro',
        'components/account/OwnerListingCard.astro',
        'components/account/OwnerListingsByState.astro'
    ],
    suscripcion: [
        'pages/[lang]/mi-cuenta/suscripcion/index.astro',
        'components/account/MySubscriptions.astro',
        'components/account/SubscriptionTabs.astro',
        'components/billing/addon-purchase/AddonOfferList.tsx'
    ],
    complementos: [
        'pages/[lang]/mi-cuenta/complementos/index.astro',
        'components/billing/recurring-addons/RecurringAddonWithdrawal.client.tsx',
        'components/account/SubscriptionTabs.astro',
        'components/billing/addon-purchase/AddonOfferList.tsx',
        'components/billing/addon-purchase/AddonTargetPicker.tsx',
        'components/billing/addon-purchase/AddonSubscriptionPicker.tsx'
    ]
};

/** §6.3 legacy primitives no migrated page may import. */
const LEGACY = [
    'AccountPageHeader',
    'AccountSectionCard',
    'AccountSection.module.css',
    'AccountButton.module.css',
    'AccountEmptyState',
    'shared/feedback/EmptyState.astro',
    'AccountPagination'
];

describe.each(Object.entries(CLOSURES))('%s closure', (_name, files) => {
    const all = files.map(read).join('\n');

    it('renders exactly one PageHeader, and no hand-written h1', () => {
        expect(all.match(/<PageHeader\b/g)).toHaveLength(1);
        expect(all).not.toMatch(/<h1[\s>]/);
    });

    it('imports none of the legacy primitives', () => {
        for (const legacy of LEGACY) expect(all, legacy).not.toContain(legacy);
    });

    it('uses only help anchors that match the HOS-2410 grammar', () => {
        const anchors = [...all.matchAll(/["'](section:[^"']+)["']/g)].map((match) => match[1]);
        for (const anchor of anchors) expect(isHelpAnchor(anchor ?? ''), anchor).toBe(true);
    });
});

describe('«Complementos» (HOS-2485, AC-8)', () => {
    const cuenta = ACCOUNT_NAV_GROUPS.find((group) =>
        group.items.some((item) => item.id === 'subscription')
    );

    it('has its own sidebar item right after «Suscripción»', () => {
        const ids = cuenta?.items.map((item) => item.id) ?? [];
        expect(ids.indexOf('addons')).toBe(ids.indexOf('subscription') + 1);
        const addons = cuenta?.items.find((item) => item.id === 'addons');
        expect(addons?.href).toBe('mi-cuenta/complementos');
        expect(addons?.i18nKey).toBe('account.nav.addons');
    });

    it('the add-ons page highlights «Suscripción»: both tabs are one page (HOS-2610 F-19)', () => {
        expect(getActiveSectionKey({ href: 'mi-cuenta/complementos' })).toBe('complementos');
        const page = read('pages/[lang]/mi-cuenta/complementos/index.astro');
        expect(page).toContain('activeSection="suscripcion"');
        expect(page).toContain("t('account.pages.subscription.title'");
    });

    it('both pages carry the «Plan / Complementos» NavTabs, each marking itself', () => {
        expect(read('pages/[lang]/mi-cuenta/suscripcion/index.astro')).toContain(
            '<SubscriptionTabs slot="tabs" locale={locale} current="plan" showAddons={billingPresence} />'
        );
        expect(read('pages/[lang]/mi-cuenta/complementos/index.astro')).toContain(
            '<SubscriptionTabs slot="tabs" locale={locale} current="addons" />'
        );
        const tabs = read('components/account/SubscriptionTabs.astro');
        expect(tabs).toContain('<NavTabs');
        expect(tabs).toContain("current: current === 'plan'");
        expect(tabs).toContain("current: current === 'addons'");
    });

    it('gates the tab navigation with the shared fail-closed billing presence check', () => {
        const page = read('pages/[lang]/mi-cuenta/suscripcion/index.astro');
        expect(page).toContain(
            'const billingPresence = await hasBillingPresence({ userId: user.id, cookieHeader });'
        );
        const tabs = read('components/account/SubscriptionTabs.astro');
        expect(tabs).toContain('readonly showAddons?: boolean');
        expect(tabs).toContain('showAddons = true');
        expect(tabs).toMatch(/\{showAddons && <NavTabs[\s\S]*\/>\}/);
    });
});
