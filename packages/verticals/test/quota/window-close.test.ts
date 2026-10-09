import { describe, expect, it } from 'vitest';
import { computeWindowClose } from '../../src/quota/window-close';
import { at } from './fixtures';

describe('AC:V3:8 — anchored market-month closing', () => {
    it('renews a 31st signup on April 30, February 28/29 and March 31, always from the anchor', () => {
        const anchor = at('2023-01-31');
        expect(computeWindowClose({ anchor, opensAt: at('2023-04-01') })).toEqual(at('2023-04-30'));
        expect(computeWindowClose({ anchor, opensAt: at('2023-02-01') })).toEqual(at('2023-02-28'));
        expect(computeWindowClose({ anchor: at('2024-01-31'), opensAt: at('2024-02-01') })).toEqual(
            at('2024-02-29')
        );
        expect(computeWindowClose({ anchor, opensAt: at('2023-02-28') })).toEqual(at('2023-03-31'));
    });

    it('renews an annual plan monthly at market midnight, not UTC midnight', () => {
        expect(computeWindowClose({ anchor: at('2026-01-15'), opensAt: at('2026-07-16') })).toEqual(
            at('2026-08-15')
        );
        expect(
            computeWindowClose({
                anchor: at('2026-01-15'),
                opensAt: new Date('2026-07-15T02:59:59Z')
            })
        ).toEqual(at('2026-07-15'));
    });
});
