import { describe, expect, it } from 'vitest';
import { resolveResourceVertical } from '../../src/authorization/resource-vertical';

describe('resolveResourceVertical', () => {
    it.each([undefined, null, 'VENUE'])('uses the resource vertical for %s', (declaredVertical) => {
        expect(resolveResourceVertical({ resourceVertical: 'VENUE', declaredVertical })).toEqual({
            allowed: true,
            vertical: 'VENUE'
        });
    });

    it('masks a mismatch as absence', () => {
        expect(
            resolveResourceVertical({
                resourceVertical: 'VENUE',
                declaredVertical: 'ACCOMMODATION'
            })
        ).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });
});
