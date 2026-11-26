import { describe, expect, it } from 'vitest';
import { resolvePrecheckPanelContent } from '../../../src/lib/host/publish-precheck-panel-content';

const BASE = {
    locale: 'es',
    editUrl: '/es/editar/draft-1',
    createUrl: '/es/publicar/nueva?create=1',
    accountPropertiesUrl: '/es/mi-cuenta/propiedades',
    subscriptionUrl: '/es/mi-cuenta/suscripcion'
} as const;

const hrefs = (decision: Parameters<typeof resolvePrecheckPanelContent>[0]['decision']) =>
    resolvePrecheckPanelContent({ ...BASE, decision }).actions.flatMap((action) =>
        action.kind === 'link' ? [action.href] : []
    );

describe('publish precheck panel content', () => {
    it('requires the caller to render the form directly for create_direct', () => {
        expect(() => resolvePrecheckPanelContent({ ...BASE, decision: 'create_direct' })).toThrow(
            /create_direct/
        );
    });

    it('offers resume and create when one draft exists and quota is available', () => {
        const result = resolvePrecheckPanelContent({ ...BASE, decision: 'resume_or_create' });
        expect(result.showQuota).toBe(false);
        expect(hrefs('resume_or_create')).toEqual([BASE.editUrl, BASE.createUrl]);
    });

    it('offers the draft picker and create when several drafts exist', () => {
        expect(hrefs('pick_draft_or_create')).toEqual([BASE.createUrl, BASE.accountPropertiesUrl]);
    });

    it.each([
        'upgrade_only',
        'resume_delete_or_upgrade',
        'pick_draft_delete_or_upgrade'
    ] as const)('%s offers the plan change alone when the catalog has no cap add-on', (decision) => {
        const actions = resolvePrecheckPanelContent({ ...BASE, decision }).actions;
        expect(
            actions.some((action) => action.kind === 'link' && action.href.includes('#addons'))
        ).toBe(false);
        expect(
            actions.some((action) => action.kind === 'link' && action.href === BASE.subscriptionUrl)
        ).toBe(true);
        expect(
            actions.some((action) => action.kind === 'link' && action.href === BASE.createUrl)
        ).toBe(false);
    });

    it.each([
        'upgrade_only',
        'resume_delete_or_upgrade',
        'pick_draft_delete_or_upgrade'
    ] as const)('%s offers the cap add-on right after the plan change', (decision) => {
        const actions = resolvePrecheckPanelContent({
            ...BASE,
            decision,
            vertical: 'venue',
            capAddon: { name: 'Ficha extra', priceLabel: '$ 5.000' }
        }).actions;
        const upgradeIndex = actions.findIndex(
            (action) => action.kind === 'link' && action.href === BASE.subscriptionUrl
        );
        expect(upgradeIndex).toBeGreaterThanOrEqual(0);
        expect(actions[upgradeIndex + 1]).toMatchObject({
            kind: 'link',
            variant: 'secondary',
            href: `${BASE.subscriptionUrl}#addons-venue`,
            labelKey: 'publish.capAddon.cta',
            labelParams: { name: 'Ficha extra', price: '$ 5.000' }
        });
    });

    it.each([
        'resume_or_create',
        'pick_draft_or_create'
    ] as const)('%s never shows the add-on: the owner is not at the cap', (decision) => {
        const actions = resolvePrecheckPanelContent({
            ...BASE,
            decision,
            capAddon: { name: 'Ficha extra', priceLabel: '$ 5.000' }
        }).actions;
        expect(
            actions.some((action) => action.kind === 'link' && action.href.includes('#addons'))
        ).toBe(false);
    });

    it('falls back to the property list when a draft has no edit URL', () => {
        const result = resolvePrecheckPanelContent({
            ...BASE,
            editUrl: undefined,
            decision: 'resume_or_create'
        });
        expect(result.actions[0]).toMatchObject({ href: BASE.accountPropertiesUrl });
    });

    it('defaults to accommodation when no vertical is given', () => {
        expect(resolvePrecheckPanelContent({ ...BASE, decision: 'upgrade_only' })).toEqual(
            resolvePrecheckPanelContent({
                ...BASE,
                vertical: 'accommodation',
                decision: 'upgrade_only'
            })
        );
    });

    it('keeps draft copy in each vertical namespace', () => {
        expect(
            resolvePrecheckPanelContent({
                ...BASE,
                vertical: 'venue',
                decision: 'resume_or_create'
            }).titleKey
        ).toBe('publish.precheck.venue.resumeOrCreate.title');
    });

    it('uses the right noun in venue fallback copy', () => {
        const body = resolvePrecheckPanelContent({
            ...BASE,
            vertical: 'venue',
            decision: 'resume_or_create'
        }).bodyFallback;
        expect(body).toContain('ficha');
        expect(body).not.toContain('propiedad');
    });

    it.each([
        ['accommodation', 'max_accommodations'],
        ['venue', 'max_venues'],
        ['experience', 'max_experiences']
    ] as const)('uses the %s copy namespace', (vertical, namespace) => {
        const result = resolvePrecheckPanelContent({ ...BASE, vertical, decision: 'upgrade_only' });
        expect(result.titleKey).toBe(`billing.limit.${namespace}.atLimitPanel.title`);
        expect(result.bodyKey).toBe(`billing.limit.${namespace}.atLimitPanel.body`);
    });
});
