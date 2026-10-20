import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { consumeQuota } from '../../src/quota/consume-quota';
import type { QuotaWindow, QuotaWindowStore } from '../../src/quota/types';
import { at, KEY, source } from './fixtures';

function memoryStore() {
    const windows: QuotaWindow[] = [];
    const store: QuotaWindowStore = {
        async withWindowLock({ run }) {
            return run({
                findLatest: async () => windows.at(-1) ?? null,
                insertWindow: async ({ opensAt, closesAt }) => {
                    const row = { id: randomUUID(), opensAt, closesAt, consumed: 0 };
                    windows.push(row);
                    return row;
                },
                addConsumed: async ({ id, amount }) => {
                    const index = windows.findIndex((window) => window.id === id);
                    const row = { ...windows[index]!, consumed: windows[index]!.consumed + amount };
                    windows[index] = row;
                    return row;
                }
            });
        }
    };
    return { store, windows };
}

describe('AC:V3:8 — all-or-nothing consumption', () => {
    it('keeps 220 on upgrade, zero on downgrade, never negative, then renews on the new 20th anchor', async () => {
        const { store, windows } = memoryStore();
        const clock = {
            current: at('2026-01-15'),
            now() {
                return this.current;
            }
        };
        const base = { store, clock, userId: 'juan', vertical: 'accommodation', key: KEY };
        expect(
            (
                await consumeQuota({
                    ...base,
                    amount: 80,
                    sources: [source('SUBSCRIPTION', at('2026-01-15'), 100)]
                })
            ).status
        ).toBe('CONSUMED');
        clock.current = at('2026-01-20');
        expect(
            await consumeQuota({
                ...base,
                amount: 1,
                sources: [source('SUBSCRIPTION', at('2026-01-20'), 300)]
            })
        ).toMatchObject({ status: 'CONSUMED', remaining: 219 });
        expect(
            await consumeQuota({
                ...base,
                amount: 1,
                sources: [source('SUBSCRIPTION', at('2026-01-20'), 50)]
            })
        ).toEqual({ status: 'EXHAUSTED', remaining: 0 });
        expect(windows).toHaveLength(1);
        clock.current = at('2026-02-15');
        expect(
            await consumeQuota({
                ...base,
                amount: 1,
                sources: [source('SUBSCRIPTION', at('2026-01-20'), 300)]
            })
        ).toMatchObject({ status: 'CONSUMED', remaining: 299 });
        expect(windows[1]?.closesAt).toEqual(at('2026-02-20'));
    });

    it('keeps a trial window through conversion; a new one opens only on first consumption after expiry', async () => {
        const { store, windows } = memoryStore();
        const clock = {
            current: at('2026-01-05'),
            now() {
                return this.current;
            }
        };
        const base = { store, clock, userId: 'juan', vertical: 'accommodation', key: KEY };
        await consumeQuota({
            ...base,
            amount: 20,
            sources: [source('TRIAL', at('2026-01-05'), 100)]
        });
        clock.current = at('2026-01-20');
        expect(
            await consumeQuota({
                ...base,
                amount: 1,
                sources: [source('SUBSCRIPTION', at('2026-01-20'), 300)]
            })
        ).toMatchObject({ status: 'CONSUMED', remaining: 279 });
        expect(windows[0]?.closesAt).toEqual(at('2026-02-05'));
        clock.current = at('2026-02-10');
        expect(windows).toHaveLength(1);
        expect(
            await consumeQuota({
                ...base,
                amount: 1,
                sources: [source('SUBSCRIPTION', at('2026-01-20'), 300)]
            })
        ).toMatchObject({ status: 'CONSUMED', remaining: 299 });
        expect(windows[1]?.closesAt).toEqual(at('2026-02-20'));
    });
});
