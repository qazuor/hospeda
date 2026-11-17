import type { HostTradeCategoryModel, HostTradeModel, SelectAllianceLead } from '@repo/db';
import type { ILogger } from '@repo/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provisionServiceProviderListing } from '../../../src/services/alliance-lead/alliance-lead.provisioning';

const TX = { __tx: true } as never;
const LEAD_ID = '00000000-0000-4000-a000-000000000001';
const HT_ID = '00000000-0000-4000-a000-0000000000aa';
const CAT_PLOMERIA = '00000000-0000-4000-a000-0000000000c1';
const CAT_DESTAP = '00000000-0000-4000-a000-0000000000c2';

const lead = (overrides: Partial<SelectAllianceLead> = {}): SelectAllianceLead =>
    ({
        id: LEAD_ID,
        kind: 'service_provider',
        email: 'juan@example.com',
        phone: null,
        applicantUserId: null,
        businessName: 'Plomeria Acme',
        category: null,
        categorySlugs: ['plomeria', 'destapaciones-desagotes'],
        destinationId: '00000000-0000-4000-a000-000000000002',
        benefitType: null,
        benefitValue: null,
        benefitText: null,
        provisionedHostTradeId: null,
        ...overrides
    }) as SelectAllianceLead;

const cat = (id: string, slug: string) => ({ id, slug });

describe('provisionServiceProviderListing — categories (HOS-919)', () => {
    let hostTradeModel: HostTradeModel;
    let categoryModel: Pick<HostTradeCategoryModel, 'findActiveBySlugs'>;
    let logger: ILogger;
    let findActiveBySlugs: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        hostTradeModel = {
            findOne: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: HT_ID }),
            replaceCategories: vi.fn().mockResolvedValue({ added: [], removed: [] })
        } as unknown as HostTradeModel;
        findActiveBySlugs = vi.fn();
        categoryModel = { findActiveBySlugs } as unknown as Pick<
            HostTradeCategoryModel,
            'findActiveBySlugs'
        >;
        logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as ILogger;
    });

    const run = (l: SelectAllianceLead, options: { tx?: never } = { tx: TX }) =>
        provisionServiceProviderListing({
            lead: l,
            hostTradeModel,
            categoryModel,
            actorId: 'admin-1',
            logger,
            tx: options.tx
        });

    it('should link exactly the two categories when both are active', async () => {
        findActiveBySlugs.mockResolvedValue([
            cat(CAT_PLOMERIA, 'plomeria'),
            cat(CAT_DESTAP, 'destapaciones-desagotes')
        ]);

        const result = await run(lead());

        expect(result).toEqual({ provisioned: true, hostTradeId: HT_ID });
        expect(findActiveBySlugs).toHaveBeenCalledWith(['plomeria', 'destapaciones-desagotes'], TX);
        expect(hostTradeModel.replaceCategories).toHaveBeenCalledTimes(1);
        expect(hostTradeModel.replaceCategories).toHaveBeenCalledWith({
            hostTradeId: HT_ID,
            categoryIds: [CAT_PLOMERIA, CAT_DESTAP],
            tx: TX
        });
    });

    it('should keep only the active category when the other was deactivated', async () => {
        findActiveBySlugs.mockResolvedValue([cat(CAT_PLOMERIA, 'plomeria')]);

        const result = await run(lead());

        expect(result.provisioned).toBe(true);
        expect(hostTradeModel.replaceCategories).toHaveBeenCalledWith(
            expect.objectContaining({ categoryIds: [CAT_PLOMERIA] })
        );
    });

    it('should skip with no-active-category and create no listing when none is active', async () => {
        findActiveBySlugs.mockResolvedValue([]);

        const result = await run(lead());

        expect(result).toEqual({ provisioned: false, reason: 'no-active-category' });
        expect(hostTradeModel.create).not.toHaveBeenCalled();
        expect(hostTradeModel.replaceCategories).not.toHaveBeenCalled();
    });

    describe('rolling-deploy lead that only carries the legacy category', () => {
        it('should map the legacy category to its catalog slugs', async () => {
            findActiveBySlugs.mockResolvedValue([cat(CAT_PLOMERIA, 'plomeria')]);

            const result = await run(lead({ category: 'PLOMERIA', categorySlugs: null }));

            expect(result).toEqual({ provisioned: true, hostTradeId: HT_ID });
            expect(findActiveBySlugs).toHaveBeenCalledWith(['plomeria'], TX);
        });

        it('should expand a legacy value that splits into several slugs', async () => {
            findActiveBySlugs.mockResolvedValue([cat(CAT_PLOMERIA, 'piletas')]);

            await run(lead({ category: 'PILETA_JARDIN', categorySlugs: [] }));

            expect(findActiveBySlugs).toHaveBeenCalledWith(['piletas', 'parque-jardineria'], TX);
        });

        it('should prefer categorySlugs over the legacy category when both are present', async () => {
            findActiveBySlugs.mockResolvedValue([cat(CAT_PLOMERIA, 'plomeria')]);

            await run(lead({ category: 'ELECTRICIDAD', categorySlugs: ['plomeria'] }));

            expect(findActiveBySlugs).toHaveBeenCalledWith(['plomeria'], TX);
        });

        it('should skip when the legacy value is unknown', async () => {
            const result = await run(lead({ category: 'NOPE' as never, categorySlugs: null }));

            expect(result).toMatchObject({
                provisioned: false,
                reason: 'legacy-lead-without-typed-fields'
            });
            expect(findActiveBySlugs).not.toHaveBeenCalled();
            expect(hostTradeModel.create).not.toHaveBeenCalled();
        });

        it('should skip when there is neither categorySlugs nor a legacy category', async () => {
            const result = await run(lead({ category: null, categorySlugs: null }));

            expect(result).toMatchObject({ provisioned: false });
            expect(hostTradeModel.create).not.toHaveBeenCalled();
        });
    });

    it('should not write the legacy category column on the new listing', async () => {
        findActiveBySlugs.mockResolvedValue([cat(CAT_PLOMERIA, 'plomeria')]);

        await run(lead({ category: 'PLOMERIA' }));

        const payload = (hostTradeModel.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
        expect(payload).not.toHaveProperty('category');
    });

    it('should insert the join rows on the same transaction as the listing', async () => {
        findActiveBySlugs.mockResolvedValue([cat(CAT_PLOMERIA, 'plomeria')]);

        await run(lead());

        expect((hostTradeModel.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toBe(TX);
        expect(
            (hostTradeModel.replaceCategories as ReturnType<typeof vi.fn>).mock.calls[0]?.[0].tx
        ).toBe(TX);
    });

    it('should fail loudly rather than write categories outside a transaction', async () => {
        findActiveBySlugs.mockResolvedValue([cat(CAT_PLOMERIA, 'plomeria')]);

        await expect(run(lead(), {})).rejects.toThrow(/transaction/);
        expect(hostTradeModel.create).not.toHaveBeenCalled();
    });
});
