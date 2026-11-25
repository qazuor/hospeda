/** Regression coverage for account discovery, dashboard and business navigation cards. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PermissionEnum as P } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_DISCOVERY_DOORS } from '../../../src/config/discovery-doors';
import { PROVIDER_NAV_GROUP } from '../../../src/config/navigation';
import { resolveTourStepBody, WEB_TOURS } from '../../../src/config/tours';
import { buildGeneralDashboardLinks } from '../../../src/lib/account/general-dashboard';
import { buildAccountNavModel } from '../../../src/lib/account-nav-model';
import { canUseAiAssistants } from '../../../src/lib/ai-assistants-access';
import { createTranslations } from '../../../src/lib/i18n';
import { isVisibleByPermissions, resolveDoorOptionState } from '../../../src/lib/nav-gating';
import { resolvePartnerStatsView } from '../../../src/lib/partner-stats-cards';

describe('CARD-150: dashboard count translations', () => {
    it.each(['es', 'en', 'pt'] as const)('resolves singular and plural counts in %s', (locale) => {
        const { tPlural } = createTranslations(locale);
        const draft = {
            es: ['borrador', 'borradores'],
            en: ['draft', 'drafts'],
            pt: ['rascunho', 'rascunhos']
        }[locale];
        for (const prefix of [
            'account.ownerDashboard.listingsDraft',
            'host.dashboard.widgets.propertiesDraft'
        ]) {
            expect(tPlural(prefix, 1)).toBe(`1 ${draft[0]}`);
            expect(tPlural(prefix, 2)).toBe(`2 ${draft[1]}`);
            expect(tPlural(prefix, 0)).toBe(`0 ${draft[1]}`);
        }
        for (const prefix of [
            'account.ownerDashboard.listingsPublished',
            'host.dashboard.widgets.propertiesPublished',
            'host.dashboard.widgets.propertiesOther',
            'account.ownerDashboard.trafficHint'
        ]) {
            for (const count of [1, 2]) {
                expect(tPlural(prefix, count, { days: 7, unique: count })).not.toMatch(
                    /MISSING|\{\{|account\.|host\./
                );
            }
        }
    });
});

describe('CARD-044: authenticated discovery copy', () => {
    it.each([
        'es',
        'en',
        'pt'
    ] as const)('never asks an authenticated visitor to sign up (%s)', (locale) => {
        const { t } = createTranslations(locale);
        const door = ACCOUNT_DISCOVERY_DOORS.find((entry) => entry.id === 'listing');
        for (const option of door?.options ?? []) {
            expect(t(option.descriptionI18nKey)).not.toMatch(
                /creá tu cuenta|create your account|crie sua conta/i
            );
            expect(t(option.ctaI18nKey)).not.toMatch(
                /creá tu cuenta|create your account|crie sua conta/i
            );
        }
    });
    it('marks an owned venue acquired and renders its manage branch without an acquire CTA', () => {
        const option = ACCOUNT_DISCOVERY_DOORS.find(
            (entry) => entry.id === 'listing'
        )?.options.find((entry) => entry.id === 'venue');
        expect(option).toBeDefined();
        if (!option) throw new Error('Missing venue discovery option');
        expect(
            resolveDoorOptionState({
                option,
                visibility: (node) => isVisibleByPermissions(node, [P.VENUE_EDIT_OWN])
            })
        ).toBe('acquired');
        const source = readFileSync(
            resolve(__dirname, '../../../src/components/account/DiscoveryDoorHub.astro'),
            'utf8'
        );
        const branch = source.slice(
            source.indexOf("{state === 'acquired'"),
            source.indexOf("{state === 'comingSoon'")
        );
        expect(branch).toContain("t('account.doors.common.manageCta')");
        expect(branch).not.toContain('option.ctaI18nKey');
    });
});

describe('CARD-164: tour enquiry audience', () => {
    const step = WEB_TOURS.find((tour) => tour.id === 'web.tourist.welcome')?.steps.find(
        (entry) => entry.id === 'inbox'
    );
    it.each([
        [[], 'account.welcomeTour.inbox.body'],
        [[P.ACCOMMODATION_CREATE], 'account.welcomeTour.inbox.body'],
        [[P.VENUE_EDIT_OWN], 'account.welcomeTour.inbox.ownerBody'],
        [[P.EXPERIENCE_EDIT_OWN], 'account.welcomeTour.inbox.ownerBody'],
        [[P.EXPERIENCE_EDIT_ALL], 'account.welcomeTour.inbox.ownerBody']
    ] as const)('selects copy from effective permissions %j', (permissions, expected) => {
        if (!step) throw new Error('Missing inbox tour step');
        expect(resolveTourStepBody({ step, permissions })).toBe(expected);
        const messages = buildGeneralDashboardLinks({ permissions }).find(
            (row) => row.id === 'messages'
        );
        expect(messages?.descriptionKey?.endsWith('myMessagesListingDesc')).toBe(
            expected.endsWith('ownerBody')
        );
    });
});

describe('CARD-068: dashboard vertical shortcuts', () => {
    it('adds the provider entry only for a session that owns a listing', () => {
        const permissions = [P.ACCOMMODATION_CREATE];
        expect(
            buildGeneralDashboardLinks({ permissions }).some((row) => row.id === 'provider')
        ).toBe(false);
        const row = buildGeneralDashboardLinks({ permissions, ownsHostTradeListing: true }).find(
            (entry) => entry.id === 'provider'
        );
        expect(row).toMatchObject({
            labelKey: PROVIDER_NAV_GROUP.items[0]?.i18nKey,
            path: PROVIDER_NAV_GROUP.items[0]?.href,
            icon: 'wrench'
        });
    });
    it('gives host, venue and experience distinct icons', () => {
        const rows = buildGeneralDashboardLinks({
            permissions: [P.ACCOMMODATION_CREATE, P.VENUE_EDIT_OWN, P.EXPERIENCE_EDIT_OWN]
        });
        expect(
            new Set(rows.filter((row) => row.id.endsWith('Dashboard')).map((row) => row.icon)).size
        ).toBe(3);
    });
});

describe('CARD-161: partner and provider business navigation', () => {
    it('activates the partner entry and groups the provider with headed business verticals', () => {
        const model = buildAccountNavModel({
            roles: null,
            permissions: [P.ACCOMMODATION_CREATE],
            ownsPartner: true,
            ownsHostTradeListing: true,
            mcpEnabled: false,
            activeSection: 'partner'
        });
        expect(model.shell.mode).toBe('business');
        expect(model.shell.groups.map((entry) => entry.group.id)).toEqual([
            'anfitrion',
            'partner',
            'proveedor'
        ]);
        expect(
            model.shell.groups.find((entry) => entry.group.id === 'partner')?.items[0]?.active
        ).toBe(true);
        expect(
            model.shell.groups.find((entry) => entry.group.id === 'proveedor')?.suppressHeader
        ).toBe(false);
        const page = readFileSync(
            resolve(__dirname, '../../../src/pages/[lang]/mi-cuenta/partner/index.astro'),
            'utf8'
        );
        expect(page).toContain('activeSection="partner"');
    });
});

describe('CARD-013 / CARD-014: fresh tourist verification', () => {
    it('has no acquired partner option or partner statistics without an owned row', () => {
        const option = ACCOUNT_DISCOVERY_DOORS.find(
            (entry) => entry.id === 'partner'
        )?.options.find((entry) => entry.id === 'partner');
        if (!option) throw new Error('Missing partner discovery option');
        expect(
            resolveDoorOptionState({
                option,
                visibility: (node) => isVisibleByPermissions(node, []),
                acquiredOptionIds: []
            })
        ).toBe('unacquired');
        expect(
            resolvePartnerStatsView({
                stats30: { available: false },
                stats7: { available: false },
                locale: 'es'
            }).visible
        ).toBe(false);
    });
    it('refuses AI assistants to a fresh tourist', () => {
        expect(
            canUseAiAssistants({
                user: { permissions: [], ownsPartner: false, ownsHostTradeListing: false }
            })
        ).toBe(false);
        const page = readFileSync(
            resolve(__dirname, '../../../src/pages/[lang]/mi-cuenta/asistentes-ia/index.astro'),
            'utf8'
        );
        expect(page).toContain('if (!canUseAiAssistants({ user }))');
        expect(page).toContain('Astro.rewrite(buildAccountNotFoundTarget({ locale }))');
    });
});
