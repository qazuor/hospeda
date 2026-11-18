/** HOS-1512 D1: the owner reviews and accepts shapes; nothing else advances the baseline. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    findLatestCompleted: vi.fn(),
    findById: vi.fn(),
    listBaselines: vi.fn(),
    acceptBaseline: vi.fn()
}));

vi.mock('@repo/db', () => ({ providerWatchRunModel: h }));

import {
    acceptShape,
    listShapeReviews
} from '../../../src/utils/provider-watch/provider-watch-review';

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '22222222-2222-4222-8222-222222222222';
const FINISHED = new Date('2026-11-17T12:00:00.000Z');
const SHAPES = { get: { $: 'object', id: 'string', payer_mail: 'string' } };
const ACCEPTED = { get: { $: 'object', id: 'string', payer_email: 'string' } };

beforeEach(() => vi.clearAllMocks());

describe('listShapeReviews', () => {
    it('is empty when the account has no completed run', async () => {
        h.findLatestCompleted.mockResolvedValue(null);
        await expect(listShapeReviews({ account: 'sandbox' })).resolves.toEqual([]);
    });

    it('shows the observed shapes with no baseline yet when nothing was accepted', async () => {
        h.findLatestCompleted.mockResolvedValue({
            id: RUN_ID,
            finishedAt: FINISHED,
            measurements: { M1: { shapes: SHAPES } }
        });
        h.listBaselines.mockResolvedValue([]);
        const [review] = await listShapeReviews({ account: 'sandbox' });
        expect(review).toMatchObject({
            measurementId: 'M1',
            runId: RUN_ID,
            accepted: null,
            acceptedBy: null,
            inSync: false,
            differences: ['no accepted baseline yet']
        });
    });

    it('lists the differences between the accepted shapes and the observation, and is not in sync', async () => {
        h.findLatestCompleted.mockResolvedValue({
            id: RUN_ID,
            finishedAt: FINISHED,
            measurements: { M1: { shapes: SHAPES } }
        });
        h.listBaselines.mockResolvedValue([
            {
                measurementId: 'M1',
                shapes: ACCEPTED,
                acceptedAt: new Date('2026-11-10T00:00:00.000Z'),
                acceptedBy: OWNER
            }
        ]);
        const [review] = await listShapeReviews({ account: 'sandbox' });
        expect(review?.inSync).toBe(false);
        expect(review?.acceptedBy).toBe(OWNER);
        expect(review?.differences).toEqual([
            'get: removed: payer_email (string)',
            'get: added: payer_mail (string)'
        ]);
    });

    it('is in sync once the accepted shapes equal the observation', async () => {
        h.findLatestCompleted.mockResolvedValue({
            id: RUN_ID,
            finishedAt: FINISHED,
            measurements: { M1: { shapes: SHAPES } }
        });
        h.listBaselines.mockResolvedValue([
            { measurementId: 'M1', shapes: SHAPES, acceptedAt: FINISHED, acceptedBy: OWNER }
        ]);
        const [review] = await listShapeReviews({ account: 'sandbox' });
        expect(review).toMatchObject({ inSync: true, differences: [] });
    });

    it('reports requests that appeared or disappeared, and orders measurements naturally', async () => {
        h.findLatestCompleted.mockResolvedValue({
            id: RUN_ID,
            finishedAt: FINISHED,
            measurements: {
                RP10: { shapes: { b: { $: 'object' } } },
                M2: { shapes: { b: { $: 'object' } } },
                M10: { shapes: { b: { $: 'object' } } }
            }
        });
        h.listBaselines.mockResolvedValue([
            {
                measurementId: 'M2',
                shapes: { a: { $: 'object' } },
                acceptedAt: FINISHED,
                acceptedBy: OWNER
            }
        ]);
        const reviews = await listShapeReviews({ account: 'sandbox' });
        expect(reviews.map((review) => review.measurementId)).toEqual(['M2', 'M10', 'RP10']);
        expect(reviews[0]?.differences).toEqual([
            'new request: b',
            'request no longer observed: a'
        ]);
    });

    it('is empty when the stored measurements cannot be read', async () => {
        h.findLatestCompleted.mockResolvedValue({
            id: RUN_ID,
            finishedAt: FINISHED,
            measurements: { M1: { shapes: 5 } }
        });
        await expect(listShapeReviews({ account: 'sandbox' })).resolves.toEqual([]);
    });
});

describe('acceptShape', () => {
    const accept = () =>
        acceptShape({ account: 'sandbox', measurementId: 'M1', runId: RUN_ID, acceptedBy: OWNER });

    it('stores what the run observed, with who accepted it', async () => {
        h.findById.mockResolvedValue({
            id: RUN_ID,
            account: 'sandbox',
            outcome: 'completed',
            measurements: { M1: { shapes: SHAPES } }
        });
        h.acceptBaseline.mockResolvedValue({ acceptedAt: FINISHED });
        await expect(accept()).resolves.toEqual({ accepted: true, acceptedAt: FINISHED });
        expect(h.acceptBaseline).toHaveBeenCalledWith({
            account: 'sandbox',
            measurementId: 'M1',
            shapes: SHAPES,
            sourceRunId: RUN_ID,
            acceptedBy: OWNER
        });
    });

    it('refuses an unknown run', async () => {
        h.findById.mockResolvedValue(null);
        await expect(accept()).resolves.toEqual({ accepted: false, refusal: 'RUN_NOT_FOUND' });
        expect(h.acceptBaseline).not.toHaveBeenCalled();
    });

    it.each([
        ['a run that did not complete', { account: 'sandbox', outcome: 'aborted' }],
        ['a run still running', { account: 'sandbox', outcome: 'running' }]
    ])('refuses %s', async (_name, run) => {
        h.findById.mockResolvedValue({
            id: RUN_ID,
            ...run,
            measurements: { M1: { shapes: SHAPES } }
        });
        await expect(accept()).resolves.toEqual({ accepted: false, refusal: 'RUN_NOT_ACCEPTABLE' });
        expect(h.acceptBaseline).not.toHaveBeenCalled();
    });

    it("answers 'not found' for a run of another account, as if it did not exist", async () => {
        h.findById.mockResolvedValue({
            id: RUN_ID,
            account: 'production',
            outcome: 'completed',
            measurements: { M1: { shapes: SHAPES } }
        });
        await expect(accept()).resolves.toEqual({ accepted: false, refusal: 'RUN_NOT_FOUND' });
        expect(h.acceptBaseline).not.toHaveBeenCalled();
    });

    it('refuses a measurement the run did not observe', async () => {
        h.findById.mockResolvedValue({
            id: RUN_ID,
            account: 'sandbox',
            outcome: 'completed',
            measurements: { M2: { shapes: SHAPES } }
        });
        await expect(accept()).resolves.toEqual({
            accepted: false,
            refusal: 'MEASUREMENT_NOT_IN_RUN'
        });
        expect(h.acceptBaseline).not.toHaveBeenCalled();
    });
});
