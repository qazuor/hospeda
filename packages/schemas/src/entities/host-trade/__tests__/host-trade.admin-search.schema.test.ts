import { describe, expect, it } from 'vitest';
import { HostTradeAdminSearchSchema } from '../host-trade.admin-search.schema.js';

/**
 * @file host-trade.admin-search.schema.test.ts
 * @description Covers the `declarationSuspended` filter (HOS-376 T-056).
 *
 * The filter is the only way the admin screen can ask "who is suspended right
 * now": a suspension lives in three nullable columns and nothing else queries
 * them. Its `false` branch is tested as carefully as its `true` branch because
 * a `false` that degrades to `undefined` returns the whole directory — every
 * provider, suspended or not — under a heading that promises the opposite.
 */
describe('HostTradeAdminSearchSchema — declarationSuspended', () => {
    it('parses the string "true" into a boolean true', () => {
        const parsed = HostTradeAdminSearchSchema.parse({ declarationSuspended: 'true' });

        expect(parsed.declarationSuspended).toBe(true);
    });

    it('parses the string "false" into a boolean false, not into true', () => {
        const parsed = HostTradeAdminSearchSchema.parse({ declarationSuspended: 'false' });

        expect(parsed.declarationSuspended).toBe(false);
    });

    it('leaves the filter undefined when it is absent', () => {
        const parsed = HostTradeAdminSearchSchema.parse({});

        expect(parsed.declarationSuspended).toBeUndefined();
    });

    it('leaves the filter undefined when it arrives empty', () => {
        const parsed = HostTradeAdminSearchSchema.parse({ declarationSuspended: '' });

        expect(parsed.declarationSuspended).toBeUndefined();
    });
});
