import { describe, expect, it, vi } from 'vitest';
import {
    memoizeInProviderReadScope,
    runWithProviderReadScope
} from '../src/provider/provider-read-scope';
import { runWithTrafficClass, type TrafficCounterSink } from '../src/provider/traffic-context';

describe('provider read scope', () => {
    it('loads every time outside a scope and shares one in-flight load inside it', async () => {
        const load = vi.fn(async () => 42);
        await memoizeInProviderReadScope({ key: 'k', load });
        await memoizeInProviderReadScope({ key: 'k', load });
        expect(load).toHaveBeenCalledTimes(2);
        await runWithProviderReadScope({
            fn: async () => {
                const values = await Promise.all([
                    memoizeInProviderReadScope({ key: 'k', load }),
                    memoizeInProviderReadScope({ key: 'k', load })
                ]);
                expect(values).toEqual([42, 42]);
            }
        });
        expect(load).toHaveBeenCalledTimes(3);
    });

    it('evicts a rejected promise after all existing callers receive its rejection', async () => {
        let calls = 0;
        await runWithProviderReadScope({
            fn: async () => {
                const load = async () => {
                    calls += 1;
                    if (calls === 1) throw new Error('failed');
                    return 'recovered';
                };
                const first = memoizeInProviderReadScope({ key: 'k', load });
                const sibling = memoizeInProviderReadScope({ key: 'k', load });
                await expect(first).rejects.toThrow('failed');
                await expect(sibling).rejects.toThrow('failed');
                await expect(memoizeInProviderReadScope({ key: 'k', load })).resolves.toBe(
                    'recovered'
                );
            }
        });
        expect(calls).toBe(2);
    });

    it('isolates nested scopes and records memo hits on the traffic sink', async () => {
        const record = vi.fn();
        const sink: TrafficCounterSink = { record, toProviderTraffic: () => ({}) };
        let calls = 0;
        await runWithTrafficClass({
            context: { trafficClass: 'background', counters: sink },
            fn: () =>
                runWithProviderReadScope({
                    fn: async () => {
                        const load = async () => ++calls;
                        expect(await memoizeInProviderReadScope({ key: 'k', load })).toBe(1);
                        expect(await memoizeInProviderReadScope({ key: 'k', load })).toBe(1);
                        await runWithProviderReadScope({
                            fn: async () => {
                                expect(await memoizeInProviderReadScope({ key: 'k', load })).toBe(
                                    2
                                );
                            }
                        });
                    }
                })
        });
        expect(record).toHaveBeenCalledWith({
            trafficClass: 'background',
            capability: 'read',
            memoHit: true
        });
    });
});
