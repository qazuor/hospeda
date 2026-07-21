/**
 * @file publish-precheck-panel-content.test.ts
 * @description Unit tests for the BETA-197 host-onboarding precheck →
 * dialog/panel content mapping. Covers every non-`create_direct` decision
 * in the matrix and asserts the exact action set (kind/variant/href) each
 * one renders, plus the `create_direct` guard.
 */

import { describe, expect, it } from 'vitest';
import { resolvePrecheckPanelContent } from '../../../src/lib/host/publish-precheck-panel-content';

const BASE_PARAMS = {
    editUrl: '/es/mi-cuenta/propiedades/draft-1/editar/',
    createUrl: '/es/publicar/nueva/?create=1',
    accountPropertiesUrl: '/es/mi-cuenta/propiedades/',
    subscriptionUrl: '/es/mi-cuenta/suscripcion/'
} as const;

describe('resolvePrecheckPanelContent', () => {
    // ── upgrade_only ─────────────────────────────────────────────────────

    it('upgrade_only: shows quota + upgrade primary CTA + "ver mis propiedades" secondary, no create/resume/delete', () => {
        const content = resolvePrecheckPanelContent({ decision: 'upgrade_only', ...BASE_PARAMS });

        expect(content.showQuota).toBe(true);
        expect(content.actions).toHaveLength(2);
        expect(content.actions[0]).toMatchObject({
            kind: 'link',
            variant: 'primary',
            href: BASE_PARAMS.subscriptionUrl
        });
        expect(content.actions[1]).toMatchObject({
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

    it('resume_delete_or_upgrade: offers resume, delete-draft, and upgrade — exactly three actions', () => {
        const content = resolvePrecheckPanelContent({
            decision: 'resume_delete_or_upgrade',
            ...BASE_PARAMS
        });

        expect(content.showQuota).toBe(true);
        expect(content.actions).toHaveLength(3);
        expect(content.actions[0]).toMatchObject({
            kind: 'link',
            variant: 'primary',
            href: BASE_PARAMS.editUrl
        });
        expect(content.actions[1]).toMatchObject({ kind: 'delete-draft' });
        expect(content.actions[2]).toMatchObject({
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

    it('pick_draft_delete_or_upgrade: offers ONLY pick-existing and upgrade — never create, never delete', () => {
        const content = resolvePrecheckPanelContent({
            decision: 'pick_draft_delete_or_upgrade',
            ...BASE_PARAMS
        });

        expect(content.showQuota).toBe(true);
        expect(content.actions).toHaveLength(2);
        expect(content.actions[0]).toMatchObject({
            kind: 'link',
            variant: 'primary',
            href: BASE_PARAMS.accountPropertiesUrl
        });
        expect(content.actions[1]).toMatchObject({
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
