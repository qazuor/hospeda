/**
 * @file publish-page-slot.test.ts
 * @description The three states of the publish form slot, and the fail-open that
 * decides which one a broken precheck lands on (HOS-1156 T-029, §6, D-1, D-5).
 *
 * Everything asserted here is a DECISION or a URL — the two things the pages
 * cannot re-derive for themselves without three copies of the same rule. The
 * `.astro` components that render the outcome are covered by their own source
 * checks; asserting on the resolved object is what actually distinguishes a
 * signed-out visitor from an owner at their cap.
 *
 * The fail-open cases are the ones worth reading first: a precheck that errors,
 * throws, or has no cookie to send must land on the FORM, never on an upgrade
 * panel. Failing closed would show "you are at your limit" to somebody with
 * quota, and the real cap sits behind the create endpoint either way.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const precheck = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/endpoints-protected', () => ({
    publishApi: { precheck }
}));

vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

import { resolvePublishPageSlot } from '@/lib/publish/publish-page-slot';

const BASE = {
    locale: 'es',
    vertical: 'accommodation',
    isAuthenticated: true,
    cookieHeader: 'session=abc',
    pathname: '/es/publicar/',
    wantsCreate: false
} as const;

/** A precheck response with the given decision and sensible counts. */
function ok(
    decision: string,
    overrides: Partial<{
        currentCount: number;
        maxAllowed: number;
        drafts: ReadonlyArray<{ id: string; slug: string; name: string }>;
    }> = {}
) {
    return {
        ok: true as const,
        data: {
            currentCount: overrides.currentCount ?? 0,
            maxAllowed: overrides.maxAllowed ?? 3,
            hasQuota: true,
            draftCount: overrides.drafts?.length ?? 0,
            drafts: overrides.drafts ?? [],
            decision
        }
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    precheck.mockResolvedValue(ok('create_direct'));
});

describe('resolvePublishPageSlot — the signed-out state (D-1, AC-5)', () => {
    it('renders the signup CTA and never asks the precheck about a session that does not exist', async () => {
        const slot = await resolvePublishPageSlot({
            ...BASE,
            isAuthenticated: false,
            cookieHeader: null
        });

        expect(slot.state).toBe('signup_cta');
        expect(precheck).not.toHaveBeenCalled();
    });

    it('carries a returnUrl back to THIS page, not to the account dashboard (AC-19)', async () => {
        const slot = await resolvePublishPageSlot({
            ...BASE,
            vertical: 'gastronomy',
            isAuthenticated: false,
            cookieHeader: null,
            pathname: '/es/publicar/gastronomia/'
        });

        expect(slot.signupUrl).toBe('/es/auth/signup/?returnUrl=%2Fes%2Fpublicar%2Fgastronomia%2F');
        expect(slot.signinUrl).toBe('/es/auth/signin/?returnUrl=%2Fes%2Fpublicar%2Fgastronomia%2F');
    });
});

describe('resolvePublishPageSlot — the decision drives the state', () => {
    it('renders the form on create_direct', async () => {
        precheck.mockResolvedValue(ok('create_direct'));
        const slot = await resolvePublishPageSlot(BASE);
        expect(slot.state).toBe('form');
    });

    for (const decision of [
        'upgrade_only',
        'resume_or_create',
        'resume_delete_or_upgrade',
        'pick_draft_or_create',
        'pick_draft_delete_or_upgrade'
    ] as const) {
        it(`renders the panel on ${decision}`, async () => {
            precheck.mockResolvedValue(ok(decision));
            const slot = await resolvePublishPageSlot(BASE);
            expect(slot.state).toBe('precheck_panel');
            expect(slot.decision).toBe(decision);
        });
    }
});

describe('resolvePublishPageSlot — the ?create=1 bypass', () => {
    for (const decision of ['resume_or_create', 'pick_draft_or_create'] as const) {
        it(`honours it on ${decision}, which actually offered "create new"`, async () => {
            precheck.mockResolvedValue(ok(decision));
            const slot = await resolvePublishPageSlot({ ...BASE, wantsCreate: true });
            expect(slot.state).toBe('form');
        });
    }

    for (const decision of [
        'upgrade_only',
        'resume_delete_or_upgrade',
        'pick_draft_delete_or_upgrade'
    ] as const) {
        it(`ignores it on ${decision}: pasting the URL cannot skip a cap`, async () => {
            precheck.mockResolvedValue(ok(decision));
            const slot = await resolvePublishPageSlot({ ...BASE, wantsCreate: true });
            expect(slot.state).toBe('precheck_panel');
        });
    }
});

describe('resolvePublishPageSlot — the fail-open (D-5, AC-12)', () => {
    it('renders the form when the precheck answers an error', async () => {
        precheck.mockResolvedValue({ ok: false, error: 'boom' });
        const slot = await resolvePublishPageSlot(BASE);
        expect(slot.state).toBe('form');
        expect(slot.decision).toBe('create_direct');
    });

    it('renders the form when the precheck throws', async () => {
        precheck.mockRejectedValue(new Error('network down'));
        const slot = await resolvePublishPageSlot(BASE);
        expect(slot.state).toBe('form');
    });

    it('renders the form when there is no cookie to forward', async () => {
        const slot = await resolvePublishPageSlot({ ...BASE, cookieHeader: null });
        expect(slot.state).toBe('form');
        expect(precheck).not.toHaveBeenCalled();
    });
});

describe('resolvePublishPageSlot — every URL is per-vertical', () => {
    const draft = { id: 'listing-1', slug: 'la-parrilla', name: 'La Parrilla' };

    it('points an accommodation panel at properties, its own editor and the bare subscription page', async () => {
        precheck.mockResolvedValue(ok('resume_or_create', { drafts: [draft] }));

        const slot = await resolvePublishPageSlot(BASE);

        expect(slot.accountListingsUrl).toBe('/es/mi-cuenta/propiedades/');
        expect(slot.editUrl).toBe('/es/mi-cuenta/propiedades/listing-1/editar/');
        expect(slot.subscriptionUrl).toBe('/es/mi-cuenta/suscripcion/');
        expect(slot.createUrl).toBe('/es/publicar/?create=1');
    });

    for (const vertical of ['gastronomy', 'experience'] as const) {
        it(`points a ${vertical} panel at commerce, the ${vertical} editor and its own billing domain`, async () => {
            precheck.mockResolvedValue(ok('resume_or_create', { drafts: [draft] }));

            const slot = await resolvePublishPageSlot({
                ...BASE,
                vertical,
                pathname: `/es/publicar/${vertical === 'gastronomy' ? 'gastronomia' : 'experiencias'}/`
            });

            expect(slot.accountListingsUrl).toBe('/es/mi-cuenta/comercio/');
            expect(slot.editUrl).toBe(`/es/mi-cuenta/comercio/${vertical}/listing-1/editar/`);
            // A commerce owner sent to the bare subscription page would read a
            // page about a subscription they may not hold (HOS-689).
            expect(slot.subscriptionUrl).toBe(`/es/mi-cuenta/suscripcion/?domain=${vertical}`);
        });
    }

    it('asks the precheck about the vertical it was given, not a default', async () => {
        await resolvePublishPageSlot({ ...BASE, vertical: 'experience' });
        expect(precheck).toHaveBeenCalledWith({
            vertical: 'experience',
            cookieHeader: 'session=abc'
        });
    });

    it('leaves editUrl undefined when there is no draft to resume', async () => {
        precheck.mockResolvedValue(ok('upgrade_only'));
        const slot = await resolvePublishPageSlot(BASE);
        expect(slot.editUrl).toBeUndefined();
    });
});
