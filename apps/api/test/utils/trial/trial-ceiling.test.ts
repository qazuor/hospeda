import type { DrizzleClient } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    readTrialCeilingDays,
    type TrialCeilingConfigurationError
} from '../../../src/utils/trial/trial-ceiling';

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    const { verticals } = await import(
        '../../../../../packages/db/src/schemas/vertical/vertical.dbschema.ts'
    );
    const { verticalDeadlineVersions } = await import(
        '../../../../../packages/db/src/schemas/vertical/vertical-deadline-version.dbschema.ts'
    );
    return {
        ...actual,
        verticals,
        verticalDeadlineVersions
    };
});

function double(rows: readonly unknown[]): DrizzleClient {
    let index = 0;
    const limit = vi.fn(async () => rows[index++]);
    const chain = { from: vi.fn(() => chain), where: vi.fn(() => chain), limit };
    return { select: vi.fn(() => chain) } as unknown as DrizzleClient;
}

describe('TEST:V8a:7 (panel, fila 4) trial ceiling reader', () => {
    it('returns the positive PLAZO:7 days', async () => {
        expect(
            await readTrialCeilingDays({
                db: double([[{ id: 'accommodation' }], [{ values: { '7': { days: 90 } } }]]),
                vertical: VerticalEnum.ACCOMMODATION,
                deadlinesVersion: 1
            })
        ).toBe(90);
    });
    it.each([
        { rows: [[], []], reason: 'VERTICAL_NOT_FOUND' },
        { rows: [[{ id: 'accommodation' }], []], reason: 'DEADLINE_VERSION_NOT_FOUND' },
        { rows: [[{ id: 'accommodation' }], [{ values: {} }]], reason: 'VALUE_MISSING' }
    ] as const)('fails closed with $reason', async ({ rows, reason }) => {
        await expect(
            readTrialCeilingDays({
                db: double(rows),
                vertical: VerticalEnum.ACCOMMODATION,
                deadlinesVersion: 1
            })
        ).rejects.toMatchObject({
            name: 'TrialCeilingConfigurationError',
            reason,
            vertical: 'accommodation',
            deadlinesVersion: 1
        } satisfies Partial<TrialCeilingConfigurationError>);
    });
});
