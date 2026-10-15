import { describe, expect, it, vi } from 'vitest';

const { addonPolicy, listing, liveAnchors, getCatalog } = vi.hoisted(() => ({
    addonPolicy: vi.fn(),
    listing: vi.fn(),
    liveAnchors: { hasLiveAnchor: vi.fn() },
    getCatalog: vi.fn(() => ({ findById: vi.fn() }))
}));

vi.mock('@repo/db', () => ({
    get planCatalogModel() {
        return getCatalog();
    }
}));
vi.mock('@repo/verticals', () => ({ createPlanCatalogInverse: () => ({ addonPolicy }) }));
vi.mock('../../src/utils/listing-publication/listing-inverse', () => ({
    createApiListingInverse: () => ({ listing })
}));
vi.mock('@repo/service-core', () => ({ permanentGrantLiveAnchors: liveAnchors }));

import { buildComplementPolicyPorts } from '../../src/utils/billing-complement-ports';

describe('buildComplementPolicyPorts', () => {
    it('builds all production policy functions and uses the real live anchor reader', () => {
        const ports = buildComplementPolicyPorts();
        expect(ports).toStrictEqual({ addonPolicy, listing, liveAnchors });
        expect(ports.addonPolicy).toBe(addonPolicy);
        expect(ports.listing).toBe(listing);
        expect(ports.liveAnchors).toBe(liveAnchors);
    });

    it('does not read the database model at module import time', async () => {
        vi.resetModules();
        getCatalog.mockClear();
        await import('../../src/utils/billing-complement-ports');
        expect(getCatalog).not.toHaveBeenCalled();
    });
});
