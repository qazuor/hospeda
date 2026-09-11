/**
 * @file publish-precheck-panel-content.test.ts
 * @description Unit tests for the BETA-197 host-onboarding precheck →
 * dialog/panel content mapping. Covers every non-`create_direct` decision
 * in the matrix and asserts the exact action set (kind/variant/href) each
 * one renders, plus the `create_direct` guard.
 *
 * HOS-727 added the add-on offer to the three at-cap decisions. Its two
 * properties are asserted separately below: it is PRESENT (with the exact
 * focus URL) where the cap is hit, and it is ABSENT everywhere the panel is
 * not a cap block at all.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
    PrecheckPanelAction,
    PrecheckPanelLinkAction
} from '../../../src/lib/host/publish-precheck-panel-content';
import { resolvePrecheckPanelContent } from '../../../src/lib/host/publish-precheck-panel-content';

const BASE_PARAMS = {
    locale: 'es',
    editUrl: '/es/mi-cuenta/propiedades/draft-1/editar/',
    createUrl: '/es/publicar/nueva/?create=1',
    accountPropertiesUrl: '/es/mi-cuenta/propiedades/',
    subscriptionUrl: '/es/mi-cuenta/suscripcion/'
} as const;

/**
 * The add-on URL the at-cap panels must point at, written out BY HAND.
 *
 * Deliberately not composed from `resolveLimitAddonOffer` / the slug table:
 * building the expectation with the same call the code makes would keep this
 * green no matter which add-on (or which page) the panel ended up linking to.
 */
const EXPECTED_ADDON_HREF =
    '/es/mi-cuenta/addons/?focus=extra-accommodations-5#addon-extra-accommodations-5';

/** Every link action pointing at the add-ons page, in render order. */
function addonLinks(actions: readonly PrecheckPanelAction[]): readonly PrecheckPanelLinkAction[] {
    return actions.filter(
        (action): action is PrecheckPanelLinkAction =>
            action.kind === 'link' && action.href.includes('/mi-cuenta/addons/')
    );
}

describe('resolvePrecheckPanelContent', () => {
    // ── upgrade_only ─────────────────────────────────────────────────────

    it('upgrade_only: leads with the add-on (HOS-727), then subscription, then "ver mis propiedades", no create/resume/delete', () => {
        const content = resolvePrecheckPanelContent({ decision: 'upgrade_only', ...BASE_PARAMS });

        expect(content.showQuota).toBe(true);
        expect(content.actions).toHaveLength(3);
        expect(content.actions[0]).toMatchObject({
            kind: 'link',
            variant: 'primary',
            href: EXPECTED_ADDON_HREF,
            labelKey: 'account.subscription.usage.buyAddon'
        });
        expect(content.actions[1]).toMatchObject({
            kind: 'link',
            variant: 'secondary',
            href: BASE_PARAMS.subscriptionUrl
        });
        expect(content.actions[2]).toMatchObject({
            kind: 'link',
            variant: 'secondary',
            href: BASE_PARAMS.accountPropertiesUrl
        });
        expect(content.actions.some((a) => a.kind === 'delete-draft')).toBe(false);
    });

    // ── resume_or_create ─────────────────────────────────────────────────

    it('resume_or_create: offers resume (editUrl) and create (createUrl), no upgrade/delete', () => {
        const content = resolvePrecheckPanelContent({
            decision: 'resume_or_create',
            ...BASE_PARAMS
        });

        expect(content.showQuota).toBe(false);
        expect(content.actions).toHaveLength(2);
        expect(content.actions[0]).toMatchObject({
            kind: 'link',
            variant: 'primary',
            href: BASE_PARAMS.editUrl
        });
        expect(content.actions[1]).toMatchObject({
            kind: 'link',
            variant: 'secondary',
            href: BASE_PARAMS.createUrl
        });
        expect(content.actions.some((a) => a.kind === 'delete-draft')).toBe(false);
        expect(
            content.actions.some((a) => a.kind === 'link' && a.href === BASE_PARAMS.subscriptionUrl)
        ).toBe(false);
    });

    it('resume_or_create: falls back the resume action href to accountPropertiesUrl when editUrl is missing', () => {
        const content = resolvePrecheckPanelContent({
            decision: 'resume_or_create',
            createUrl: BASE_PARAMS.createUrl,
            accountPropertiesUrl: BASE_PARAMS.accountPropertiesUrl,
            subscriptionUrl: BASE_PARAMS.subscriptionUrl
        });

        expect(content.actions[0]).toMatchObject({ href: BASE_PARAMS.accountPropertiesUrl });
    });

    // ── resume_delete_or_upgrade ─────────────────────────────────────────

    it('resume_delete_or_upgrade: offers resume, delete-draft, add-on, and upgrade — exactly four actions', () => {
        const content = resolvePrecheckPanelContent({
            decision: 'resume_delete_or_upgrade',
            ...BASE_PARAMS
        });

        expect(content.showQuota).toBe(true);
        expect(content.actions).toHaveLength(4);
        expect(content.actions[0]).toMatchObject({
            kind: 'link',
            variant: 'primary',
            href: BASE_PARAMS.editUrl
        });
        expect(content.actions[1]).toMatchObject({ kind: 'delete-draft' });
        // HOS-727: the paid unblock never outranks the free one — the draft
        // actions keep the primary slot, the add-on is a secondary link.
        expect(content.actions[2]).toMatchObject({
            kind: 'link',
            variant: 'secondary',
            href: EXPECTED_ADDON_HREF
        });
        expect(content.actions[3]).toMatchObject({
            kind: 'link',
            variant: 'secondary',
            href: BASE_PARAMS.subscriptionUrl
        });
        // Never offers a direct "create new" when the actor has no quota.
        expect(
            content.actions.some((a) => a.kind === 'link' && a.href === BASE_PARAMS.createUrl)
        ).toBe(false);
    });

    // ── pick_draft_or_create ─────────────────────────────────────────────

    it('pick_draft_or_create: offers create (createUrl) and pick-existing (accountPropertiesUrl), no resume/delete/upgrade', () => {
        const content = resolvePrecheckPanelContent({
            decision: 'pick_draft_or_create',
            ...BASE_PARAMS
        });

        expect(content.showQuota).toBe(false);
        expect(content.actions).toHaveLength(2);
        expect(content.actions[0]).toMatchObject({
            kind: 'link',
            variant: 'primary',
            href: BASE_PARAMS.createUrl
        });
        expect(content.actions[1]).toMatchObject({
            kind: 'link',
            variant: 'secondary',
            href: BASE_PARAMS.accountPropertiesUrl
        });
        expect(content.actions.some((a) => a.kind === 'delete-draft')).toBe(false);
    });

    // ── pick_draft_delete_or_upgrade ─────────────────────────────────────

    it('pick_draft_delete_or_upgrade: offers pick-existing, the add-on and upgrade — never create, never delete', () => {
        const content = resolvePrecheckPanelContent({
            decision: 'pick_draft_delete_or_upgrade',
            ...BASE_PARAMS
        });

        expect(content.showQuota).toBe(true);
        expect(content.actions).toHaveLength(3);
        expect(content.actions[0]).toMatchObject({
            kind: 'link',
            variant: 'primary',
            href: BASE_PARAMS.accountPropertiesUrl
        });
        expect(content.actions[1]).toMatchObject({
            kind: 'link',
            variant: 'secondary',
            href: EXPECTED_ADDON_HREF
        });
        expect(content.actions[2]).toMatchObject({
            kind: 'link',
            variant: 'secondary',
            href: BASE_PARAMS.subscriptionUrl
        });
        expect(content.actions.some((a) => a.kind === 'delete-draft')).toBe(false);
        expect(
            content.actions.some((a) => a.kind === 'link' && a.href === BASE_PARAMS.createUrl)
        ).toBe(false);
    });

    // ── create_direct guard ───────────────────────────────────────────────

    it('create_direct: throws — callers must render the onboarding form directly instead', () => {
        expect(() =>
            resolvePrecheckPanelContent({ decision: 'create_direct', ...BASE_PARAMS })
        ).toThrow(/create_direct/);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// HOS-727 — the contextual add-on offer
// ─────────────────────────────────────────────────────────────────────────────

describe('HOS-727: the add-on offer appears exactly where the cap is hit', () => {
    const AT_CAP_DECISIONS = [
        'upgrade_only',
        'resume_delete_or_upgrade',
        'pick_draft_delete_or_upgrade'
    ] as const;

    const NOT_AT_CAP_DECISIONS = ['resume_or_create', 'pick_draft_or_create'] as const;

    it.each(
        AT_CAP_DECISIONS
    )('%s offers exactly one add-on link, pointing at the focused extra-accommodations-5 card', (decision) => {
        const links = addonLinks(resolvePrecheckPanelContent({ decision, ...BASE_PARAMS }).actions);

        expect(links).toHaveLength(1);
        expect(links[0]?.href).toBe(EXPECTED_ADDON_HREF);
        expect(links[0]?.labelKey).toBe('account.subscription.usage.buyAddon');
    });

    it.each(
        NOT_AT_CAP_DECISIONS
    )('%s offers NO add-on link — the host is not blocked by a cap there', (decision) => {
        expect(
            addonLinks(resolvePrecheckPanelContent({ decision, ...BASE_PARAMS }).actions)
        ).toHaveLength(0);
    });

    it('carries the caller locale into the add-on URL instead of assuming Spanish', () => {
        const links = addonLinks(
            resolvePrecheckPanelContent({
                ...BASE_PARAMS,
                decision: 'upgrade_only',
                locale: 'en'
            }).actions
        );

        expect(links[0]?.href).toBe(
            '/en/mi-cuenta/addons/?focus=extra-accommodations-5#addon-extra-accommodations-5'
        );
    });
});

describe('HOS-727: the offer is resolved from the limit, never hardcoded', () => {
    const MODULE_SOURCE = readFileSync(
        resolve(__dirname, '../../../src/lib/host/publish-precheck-panel-content.ts'),
        'utf8'
    );

    /** Source with comments stripped, so prose about a slug is not read as code. */
    const CODE = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    it('names no add-on slug and no add-ons path of its own', () => {
        // This is what makes the "no false promise" rule hold for the OTHER 15
        // limits too: with nothing hardcoded, the CTA can only ever exist for a
        // limit that `ADDON_SLUG_BY_LIMIT_KEY` actually sells, and it vanishes
        // by itself the day `extra-accommodations-5` is withdrawn.
        expect(CODE).not.toContain('extra-accommodations-5');
        expect(CODE).not.toContain('mi-cuenta/addons');
        expect(CODE).not.toContain('?focus=');
    });

    it('goes through the shared resolver rather than re-deriving the mapping', () => {
        expect(CODE).toContain('resolveLimitAddonOffer');
        // A second implementation of the limit→slug lookup here is exactly the
        // "canonical helper created, call sites not migrated" drift this repo
        // keeps re-introducing in billing.
        expect(CODE).not.toContain('addonSlugForLimit');
        expect(CODE).not.toContain('buildAddonFocusUrl');
    });

    it('takes the cap from the exhaustive vertical map, never from a literal', () => {
        // HOS-1156 T-013 CHANGED THIS ASSERTION, deliberately. It used to read
        // `expect(CODE).toContain('LimitKey.MAX_ACCOMMODATIONS')`, freezing the
        // hardcoded accommodation cap — which is precisely what made the change
        // an explicit decision instead of a silent drift: generalising the panel
        // could not happen without a human coming here and rewriting this line.
        //
        // The RULE it protects is unchanged: the caller still may not choose
        // which add-on this panel points at. What answers that question is now
        // the vertical, through a map that is total and closed over
        // `PublishVertical`, so the reachable set of caps is exactly three
        // rather than the whole catalogue.
        expect(CODE).toContain('LIMIT_KEY_BY_PUBLISH_VERTICAL[vertical]');

        // No literal cap may come back. A `LimitKey.SOMETHING` here would be a
        // second, unmapped answer to the same question — the shape the map
        // exists to prevent.
        expect(CODE).not.toMatch(/LimitKey\.[A-Z_]+/);
    });

    it('does not let the caller pass a limit key directly', () => {
        // The distinction the module docblock draws: a vertical is a closed
        // choice among three, a `limitKey` parameter would be an open one among
        // every cap in the catalogue.
        expect(CODE).not.toMatch(/readonly\s+limitKey/);
    });
});

describe('HOS-1156: each vertical speaks about its OWN cap', () => {
    /**
     * The add-on URL each vertical's at-cap panel must point at, written out BY
     * HAND for the same reason the accommodation one above is: composing it with
     * the call the code makes would keep this green whichever add-on the panel
     * ended up linking to.
     */
    const EXPECTED_ADDON_HREF = {
        accommodation:
            '/es/mi-cuenta/addons/?focus=extra-accommodations-5#addon-extra-accommodations-5',
        gastronomy: '/es/mi-cuenta/addons/?focus=extra-gastronomies-1#addon-extra-gastronomies-1',
        experience: '/es/mi-cuenta/addons/?focus=extra-experiences-1#addon-extra-experiences-1'
    } as const;

    it.each([
        'accommodation',
        'gastronomy',
        'experience'
    ] as const)("offers %s its own add-on, not another vertical's", (vertical) => {
        const content = resolvePrecheckPanelContent({
            decision: 'upgrade_only',
            vertical,
            ...BASE_PARAMS
        });

        const addon = content.actions.find(
            (a) => a.kind === 'link' && a.href.includes('/mi-cuenta/addons/')
        );

        expect(addon).toMatchObject({ href: EXPECTED_ADDON_HREF[vertical] });
    });

    it.each([
        ['accommodation', 'max_accommodations'],
        ['gastronomy', 'max_gastronomies'],
        ['experience', 'max_experiences']
    ] as const)('keys %s at-limit copy on %s', (vertical, limitKey) => {
        const content = resolvePrecheckPanelContent({
            decision: 'upgrade_only',
            vertical,
            ...BASE_PARAMS
        });

        expect(content.titleKey).toBe(`billing.limit.${limitKey}.atLimitPanel.title`);
        expect(content.bodyKey).toBe(`billing.limit.${limitKey}.atLimitPanel.body`);
    });

    it('defaults to accommodation when no vertical is given', () => {
        // Every caller that predates HOS-1156 must keep its exact behaviour.
        const withDefault = resolvePrecheckPanelContent({
            decision: 'upgrade_only',
            ...BASE_PARAMS
        });
        const explicit = resolvePrecheckPanelContent({
            decision: 'upgrade_only',
            vertical: 'accommodation',
            ...BASE_PARAMS
        });

        expect(withDefault).toEqual(explicit);
    });

    it('gives each vertical its own draft-copy namespace', () => {
        const gastronomy = resolvePrecheckPanelContent({
            decision: 'resume_or_create',
            vertical: 'gastronomy',
            ...BASE_PARAMS
        });
        const accommodation = resolvePrecheckPanelContent({
            decision: 'resume_or_create',
            vertical: 'accommodation',
            ...BASE_PARAMS
        });

        expect(accommodation.titleKey).toBe('host.pages.nueva.precheck.resumeOrCreate.title');
        expect(gastronomy.titleKey).toBe('publish.precheck.gastronomy.resumeOrCreate.title');
    });

    it('names the right thing in the untranslated fallback', () => {
        // A fallback is what a reader sees when the key is missing. "Tenés una
        // propiedad sin publicar" on the gastronomy page is worse than generic:
        // it is wrong.
        const gastronomy = resolvePrecheckPanelContent({
            decision: 'resume_or_create',
            vertical: 'gastronomy',
            ...BASE_PARAMS
        });

        expect(gastronomy.bodyFallback).toContain('ficha');
        expect(gastronomy.bodyFallback).not.toContain('propiedad');
    });
});
