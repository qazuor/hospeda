import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { PublishPageSlot } from '@/lib/publish/publish-page-slot';
import {
    resolvePublishPageFlow,
    resolvePublishPageVariant
} from '@/lib/publish/publish-page-variant';

const slot: PublishPageSlot = {
    state: 'precheck_panel',
    decision: 'resume_or_create',
    currentCount: 1,
    maxAllowed: 2,
    drafts: [{ id: 'draft-1', slug: 'draft-1', name: 'Draft' }],
    editUrl: '/es/mi-cuenta/propiedades/draft-1/editar/',
    createUrl: '/es/publicar/?create=1',
    accountListingsUrl: '/es/mi-cuenta/propiedades/',
    subscriptionUrl: '/es/mi-cuenta/suscripcion/',
    signupUrl: '/es/auth/signup/',
    signinUrl: '/es/auth/signin/'
};

describe('resolvePublishPageVariant', () => {
    it.each([
        [false, false, false, 'guest'],
        [false, true, false, 'guest'],
        [false, false, true, 'guest'],
        [false, true, true, 'guest'],
        [true, false, false, 'member'],
        [true, true, false, 'direct'],
        [true, false, true, 'direct'],
        [true, true, true, 'direct']
    ] as const)('session=%s, plans=%s, access=%s → %s', (isAuthenticated, fromPlans, hasVerticalAccess, expected) => {
        expect(resolvePublishPageVariant({ isAuthenticated, fromPlans, hasVerticalAccess })).toBe(
            expected
        );
    });
});

describe('resolvePublishPageFlow', () => {
    const input = {
        isAuthenticated: true,
        permissions: [],
        vertical: 'accommodation',
        searchParams: new URLSearchParams('desde=planes'),
        slot
    } as const;

    it('resumes a single draft on a direct journey', () => {
        expect(resolvePublishPageFlow(input)).toEqual({
            variant: 'direct',
            redirectUrl: slot.editUrl
        });
    });

    it.each([
        'accommodation',
        'venue',
        'experience'
    ] as const)('uses only %s access from the account menu predicate', (vertical) => {
        const permission = {
            accommodation: PermissionEnum.ACCOMMODATION_CREATE,
            venue: PermissionEnum.VENUE_EDIT_OWN,
            experience: PermissionEnum.EXPERIENCE_EDIT_OWN
        }[vertical];
        expect(
            resolvePublishPageFlow({
                ...input,
                vertical,
                permissions: [permission],
                searchParams: new URLSearchParams()
            }).variant
        ).toBe('direct');
        expect(
            resolvePublishPageFlow({
                ...input,
                vertical,
                permissions: [PermissionEnum.POST_CREATE],
                searchParams: new URLSearchParams()
            }).variant
        ).toBe('member');
    });

    it.each([
        '',
        'desde=other',
        'desde=Planes'
    ])('requires the exact plans marker (%s)', (query) => {
        expect(
            resolvePublishPageFlow({ ...input, searchParams: new URLSearchParams(query) })
        ).toEqual({ variant: 'member', redirectUrl: undefined });
    });

    it.each([
        'upgrade_only',
        'resume_delete_or_upgrade',
        'pick_draft_or_create',
        'pick_draft_delete_or_upgrade',
        'create_direct'
    ] as const)('keeps the %s decision on the page', (decision) => {
        expect(
            resolvePublishPageFlow({ ...input, slot: { ...slot, decision } }).redirectUrl
        ).toBeUndefined();
    });

    it('does not redirect guests, members, forms, missing editor URLs, or multiple drafts', () => {
        const cases = [
            { ...input, isAuthenticated: false },
            { ...input, searchParams: new URLSearchParams() },
            { ...input, slot: { ...slot, state: 'form' as const } },
            { ...input, slot: { ...slot, editUrl: undefined } },
            { ...input, slot: { ...slot, drafts: [] } },
            {
                ...input,
                slot: {
                    ...slot,
                    drafts: [...slot.drafts, { id: 'draft-2', slug: 'draft-2', name: 'Other' }]
                }
            }
        ];
        for (const candidate of cases) {
            expect(resolvePublishPageFlow(candidate).redirectUrl).toBeUndefined();
        }
    });
});
