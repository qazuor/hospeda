import { describe, expect, it } from 'vitest';

import { getWelcomeTourForRoles, WEB_TOURS } from '../../src/config/tours';

describe('web tours config', () => {
    it('returns the host welcome tour for host roles', () => {
        expect(getWelcomeTourForRoles({ roles: ['HOST'] })?.id).toBe('web.host.welcome');
        expect(getWelcomeTourForRoles({ roles: ['ADMIN'] })?.id).toBe('web.host.welcome');
    });

    it('returns the commerce welcome tour for commerce owners', () => {
        expect(getWelcomeTourForRoles({ roles: ['COMMERCE_OWNER'] })?.id).toBe(
            'web.commerce.welcome'
        );
    });

    it('matches on ANY held role, not just the first one (HOS-296)', () => {
        // A plain USER hat sits first on every account; the tour must still be
        // found from the business hat that follows it.
        expect(getWelcomeTourForRoles({ roles: ['USER', 'COMMERCE_OWNER'] })?.id).toBe(
            'web.commerce.welcome'
        );
        expect(getWelcomeTourForRoles({ roles: ['USER', 'HOST'] })?.id).toBe('web.host.welcome');
    });

    it('picks a deterministic tour for a multi-hat user (WEB_TOURS order is the tie-break)', () => {
        // A HOST who is also a COMMERCE_OWNER matches both audiences. Only one
        // tour can run on first visit, so the first entry in WEB_TOURS wins —
        // pinned here so a reorder is a deliberate, visible decision.
        const resolved = getWelcomeTourForRoles({ roles: ['HOST', 'COMMERCE_OWNER'] });
        expect(resolved?.id).toBe('web.host.welcome');
        expect(getWelcomeTourForRoles({ roles: ['COMMERCE_OWNER', 'HOST'] })?.id).toBe(
            resolved?.id
        );
    });

    it('returns no tour for a guest, an empty role set, or a role with no tour', () => {
        expect(getWelcomeTourForRoles({ roles: null })).toBeUndefined();
        expect(getWelcomeTourForRoles({ roles: [] })).toBeUndefined();
        expect(getWelcomeTourForRoles({ roles: ['USER'] })).toBeUndefined();
    });

    it('keeps DOM selectors aligned with account navigation tour targets', () => {
        const hostTour = WEB_TOURS.find((tour) => tour.id === 'web.host.welcome');
        expect(hostTour?.steps.map((step) => step.target)).toEqual([
            'center',
            '[data-tour="properties"]',
            '[data-tour="host-dashboard"]',
            '[data-tour="messages"]',
            '[data-tour="promotions"]',
            '[data-tour="profile"]'
        ]);
    });
});
