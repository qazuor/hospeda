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

    it.each([
        ['accommodation', 'host.pages.nueva.precheck'],
        ['gastronomy', 'publish.precheck.gastronomy'],
        ['experience', 'publish.precheck.experience']
    ] as const)('uses the %s copy namespace', (vertical, namespace) => {
        const result = resolvePrecheckPanelContent({ ...BASE, vertical, decision: 'upgrade_only' });
        expect(result.titleKey).toBe(`${namespace}.atLimitPanel.title`);
    });
});
