/**
 * Unit tests for the step 3a snapshot loader (HOS-1957 G8): SELECT-only, with
 * column mapping and pg type coercion.
 */
import { describe, expect, it } from 'vitest';
import { loadCatalogSnapshot } from '../../../src/services/cutover-v6/verify-catalog.load.js';

describe('loadCatalogSnapshot', () => {
    it('issues only SELECT statements and maps rows', async () => {
        // Arrange
        const statements: string[] = [];
        const query = async (sql: string) => {
            statements.push(sql);
            if (sql.includes('FROM billing_option')) {
                return {
                    rows: [
                        { plan_version_id: 'v', cycle: 'monthly', amount: '18000', currency: 'ARS' }
                    ]
                };
            }
            if (sql.includes('FROM promo_code')) {
                return {
                    rows: [
                        {
                            code: 'X',
                            effect_kind: 'DISCOUNT',
                            extension_days: null,
                            discount_kind: 'FIXED',
                            value: 5,
                            all_verticals: true,
                            verticals: null,
                            valid_from: '2026-10-01T00:00:00Z',
                            valid_until: null,
                            duration_kind: 'FOREVER',
                            duration_charges: null,
                            closed_at: null
                        }
                    ]
                };
            }
            return { rows: [] };
        };

        // Act
        const snapshot = await loadCatalogSnapshot({
            query,
            now: new Date('2026-11-01T00:00:00Z')
        });

        // Assert
        expect(statements.length).toBeGreaterThan(0);
        expect(statements.every((s) => /^\s*SELECT\b/i.test(s))).toBe(true);
        expect(snapshot.billingOptions[0]?.amount).toBe(18000);
        expect(snapshot.promoCodes[0]?.validFrom).toBeInstanceOf(Date);
        expect(snapshot.promoCodes[0]?.verticals).toBeNull();
    });
});
