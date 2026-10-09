import { describe, expect, it } from 'vitest';
import { resolveResourceVertical } from '../../src/authorization/resource-vertical';

describe('resolveResourceVertical', () => {
    it.each([
        undefined,
        null,
        'GASTRONOMY'
    ])('uses the resource vertical for %s', (declaredVertical) => {
        expect(
            resolveResourceVertical({ resourceVertical: 'GASTRONOMY', declaredVertical })
        ).toEqual({ allowed: true, vertical: 'GASTRONOMY' });
    });

    it('masks a mismatch as absence', () => {
        expect(
            resolveResourceVertical({
                resourceVertical: 'GASTRONOMY',
                declaredVertical: 'ACCOMMODATION'
            })
        ).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });
});
