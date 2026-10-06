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

describe('publish precheck panel content during the billing transition', () => {
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
    ] as const)('%s offers no retired billing add-on link', (decision) => {
        const actions = resolvePrecheckPanelContent({ ...BASE, decision }).actions;
        expect(
            actions.some((action) => action.kind === 'link' && action.href.includes('addons'))
        ).toBe(false);
        expect(
            actions.some((action) => action.kind === 'link' && action.href === BASE.subscriptionUrl)
        ).toBe(true);
        expect(
            actions.some((action) => action.kind === 'link' && action.href === BASE.createUrl)
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
                vertical: 'gastronomy',
                decision: 'resume_or_create'
            }).titleKey
        ).toBe('publish.precheck.gastronomy.resumeOrCreate.title');
    });

    it('uses the right noun in gastronomy fallback copy', () => {
        const body = resolvePrecheckPanelContent({
            ...BASE,
            vertical: 'gastronomy',
            decision: 'resume_or_create'
        }).bodyFallback;
        expect(body).toContain('ficha');
        expect(body).not.toContain('propiedad');
    });

    it.each([
        ['accommodation', 'max_accommodations'],
        ['gastronomy', 'max_gastronomies'],
        ['experience', 'max_experiences']
    ] as const)('uses the %s copy namespace', (vertical, namespace) => {
        const result = resolvePrecheckPanelContent({ ...BASE, vertical, decision: 'upgrade_only' });
        expect(result.titleKey).toBe(`billing.limit.${namespace}.atLimitPanel.title`);
        expect(result.bodyKey).toBe(`billing.limit.${namespace}.atLimitPanel.body`);
    });
});
