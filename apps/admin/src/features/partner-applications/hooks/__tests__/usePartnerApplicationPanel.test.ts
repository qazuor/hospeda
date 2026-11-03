import { describe, expect, it } from 'vitest';
import { buildPartnerApplicationPanelPath } from '../usePartnerApplicationPanel';

describe('buildPartnerApplicationPanelPath', () => {
    it('builds the selected view and pagination in stable order', () => {
        expect(buildPartnerApplicationPanelPath({ view: 'pending', page: 1, pageSize: 50 })).toBe(
            '/api/v1/admin/partner-applications?view=pending&page=1&pageSize=50'
        );
        expect(
            buildPartnerApplicationPanelPath({ view: 'rejectedWaiting', page: 2, pageSize: 25 })
        ).toBe('/api/v1/admin/partner-applications?view=rejectedWaiting&page=2&pageSize=25');
    });
});
