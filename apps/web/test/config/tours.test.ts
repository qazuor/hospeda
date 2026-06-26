import { describe, expect, it } from 'vitest';

import { WEB_TOURS, getWelcomeTourForRole } from '../../src/config/tours';

describe('web tours config', () => {
    it('returns the host welcome tour for host roles', () => {
        expect(getWelcomeTourForRole('HOST')?.id).toBe('web.host.welcome');
        expect(getWelcomeTourForRole('ADMIN')?.id).toBe('web.host.welcome');
    });

    it('returns the commerce welcome tour for commerce owners', () => {
        expect(getWelcomeTourForRole('COMMERCE_OWNER')?.id).toBe('web.commerce.welcome');
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
