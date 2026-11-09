import { describe, expect, it } from 'vitest';
import { parseReturnOrderRequestId } from '@/lib/billing/addon-purchase-return';

describe('addon purchase return parameter', () => {
    it('accepts only one valid order identity', () => {
        expect(
            parseReturnOrderRequestId({ search: '?compra=123e4567-e89b-42d3-a456-426614174000' })
        ).toBe('123e4567-e89b-42d3-a456-426614174000');
        expect(parseReturnOrderRequestId({ search: '?compra=invalid' })).toBeNull();
    });
});
