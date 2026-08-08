import { describe, expect, it } from 'vitest';
import { PartnerSearchHttpSchema } from '../partner.http.schema.js';

/**
 * The four query params the retired directory used to filter by (HOS-294 D-5).
 *
 * Removing them is the point: the directory with filters is not coming back,
 * and leaving the params accepted means anyone can rebuild it with a `curl`
 * even after the page is deleted.
 */
const DIRECTORY_FILTER_PARAMS = ['q', 'type', 'tier', 'subscriptionStatus'] as const;

describe('PartnerSearchHttpSchema — the directory filters are gone (HOS-294 AC-9)', () => {
    it.each(DIRECTORY_FILTER_PARAMS)('no longer declares the %s param', (param) => {
        // Arrange / Act
        const shape = PartnerSearchHttpSchema.shape as Record<string, unknown>;

        // Assert
        expect(shape[param], `"${param}" is still declared`).toBeUndefined();
    });

    it('discards every directory filter instead of applying it', () => {
        // Arrange — the exact query string the old page produced. The service
        // is handed the PARSED object, so a param Zod drops here can no longer
        // reach the model no matter what a caller sends.
        const query = {
            page: '1',
            pageSize: '20',
            q: 'panaderia',
            type: 'ngo',
            tier: 'gold',
            subscriptionStatus: 'active'
        };

        // Act
        const result = PartnerSearchHttpSchema.safeParse(query);

        // Assert — parsing SUCCEEDS (a stripped key is not a rejection) and the
        // filters simply are not there.
        expect(result.success).toBe(true);
        if (result.success) {
            for (const param of DIRECTORY_FILTER_PARAMS) {
                expect(result.data).not.toHaveProperty(param);
            }
        }
    });

    it('still accepts the pagination the home carousel sends', () => {
        // Arrange — the carousel is the only remaining caller and it sends
        // pageSize alone. Trimming the filters must not break it.
        const result = PartnerSearchHttpSchema.safeParse({ pageSize: '20' });

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.pageSize).toBe(20);
        }
    });
});
