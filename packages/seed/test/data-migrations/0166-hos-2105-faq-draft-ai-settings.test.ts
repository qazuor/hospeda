import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRows, mockUpdate, mockSet } = vi.hoisted(() => ({
    mockRows: vi.fn(),
    mockUpdate: vi.fn(),
    mockSet: vi.fn()
}));
vi.mock('@repo/db', () => ({
    aiSettings: { key: 'key-column', value: 'value-column' },
    eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
    SYSTEM_USER_ID: '00000000-0000-4000-8000-000000000001'
}));

import { AiFeatureSchema } from '@repo/schemas';
import { up } from '../../src/data-migrations/0166-hos-2105-faq-draft-ai-settings.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

function fakeContext(): SeedMigrationCtx {
    const db = {
        select: () => ({ from: () => ({ where: () => ({ limit: mockRows }) }) }),
        update: () => ({ set: mockSet })
    };
    mockSet.mockReturnValue({ where: mockUpdate });
    mockUpdate.mockResolvedValue([]);
    return {
        db: db as unknown as SeedMigrationCtx['db'],
        actor: {} as SeedMigrationCtx['actor'],
        models: {} as SeedMigrationCtx['models'],
        services: {} as SeedMigrationCtx['services'],
        helpers: { safeDelete: vi.fn() } as unknown as SeedMigrationCtx['helpers']
    };
}

function settingsValue() {
    const feature = {
        enabled: true,
        primaryProvider: 'stub',
        fallbackChain: [],
        model: 'chat-model',
        params: {}
    };
    return {
        providers: { stub: { enabled: true } },
        features: Object.fromEntries(
            AiFeatureSchema.options
                .filter((key) => key !== 'faq_draft')
                .map((key) => [key, feature])
        )
    };
}

describe('0166 HOS-2105 FAQ draft settings migration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('adds gpt-5.4-mini while preserving chat provider settings', async () => {
        const value = settingsValue();
        mockRows.mockResolvedValueOnce([{ value }]);

        const result = await up(fakeContext());

        expect(result.counts?.featuresAdded).toBe(1);
        const next = mockSet.mock.calls[0]?.[0].value as ReturnType<typeof settingsValue>;
        expect(next.features.faq_draft).toEqual({ ...value.features.chat, model: 'gpt-5.4-mini' });
        expect(next.features.chat).toEqual(value.features.chat);
    });

    it('does nothing when the global settings row is absent', async () => {
        mockRows.mockResolvedValueOnce([]);
        const result = await up(fakeContext());
        expect(result.counts?.featuresAdded).toBe(0);
        expect(mockSet).not.toHaveBeenCalled();
    });

    it('preserves an operator-edited FAQ draft configuration on re-run', async () => {
        const value = settingsValue();
        value.features.faq_draft = { ...value.features.chat, model: 'custom-operator-model' };
        mockRows.mockResolvedValueOnce([{ value }]);
        const result = await up(fakeContext());
        expect(result.counts?.featuresAdded).toBe(0);
        expect(mockSet).not.toHaveBeenCalled();
    });
});
