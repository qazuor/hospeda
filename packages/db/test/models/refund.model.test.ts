import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefundModel } from '../../src/models/invoice/refund.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

const mockDb = {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    from: vi.fn()
};

vi.mock('../../src/client', () => ({
    getDb: vi.fn(() => mockDb)
}));

describe('RefundModel', () => {
    let refundModel: RefundModel;

    beforeEach(() => {
        refundModel = new RefundModel();
        vi.clearAllMocks();
    });

    it('should create instance', () => {
        expect(refundModel).toBeInstanceOf(RefundModel);
    });

    it('should validate positive amounts', async () => {
        vi.spyOn(refundModel, 'calculateRefundable').mockResolvedValue(10000);

        const result = await refundModel.validateRefundAmount('payment-id', 5000);

        expect(result.valid).toBe(true);
    });

    it('should reject negative amounts', async () => {
        const result = await refundModel.validateRefundAmount('payment-id', -1000);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('AMOUNT_MUST_BE_POSITIVE');
    });

    it('should reject amounts exceeding refundable', async () => {
        vi.spyOn(refundModel, 'calculateRefundable').mockResolvedValue(5000);

        const result = await refundModel.validateRefundAmount('payment-id', 10000);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('AMOUNT_EXCEEDS_REFUNDABLE');
    });
});
