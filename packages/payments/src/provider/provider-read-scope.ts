/**
 * Raw provider inputs use `memoizeInProviderReadScope` (adapter only). A
 * stamped `ProviderRead` may be shared only through `shareProviderReadForAct`,
 * only within the same act object, and never across acts (INV:D17, spec §6.2
 * decision 2026-11-03). The only consumer is `readChargeForAct`.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ActStart, ProviderRead } from './provider-read';
import { isProviderRead } from './provider-read';
import { currentTrafficContext } from './traffic-context';

interface ProviderReadScope {
    readonly values: Map<string, Promise<unknown>>;
}

const scopeStorage = new AsyncLocalStorage<ProviderReadScope>();
const actIds = new WeakMap<ActStart, number>();
let nextActId = 0;

/** Run asynchronous provider reads in a new independent memo scope. */
export async function runWithProviderReadScope<T>(args: {
    readonly fn: () => Promise<T>;
}): Promise<T> {
    return await scopeStorage.run({ values: new Map() }, args.fn);
}

/**
 * Share a raw provider input promise within the active scope. Only fulfilled
 * inputs remain cached. Stamped reads must use `shareProviderReadForAct`.
 */
export async function memoizeInProviderReadScope<T>(args: {
    readonly key: string;
    readonly load: () => Promise<T>;
}): Promise<T> {
    const scope = scopeStorage.getStore();
    if (!scope) return await args.load();
    const existing = scope.values.get(args.key);
    if (existing) {
        const value = (await existing) as T;
        const context = currentTrafficContext();
        if (context?.counters)
            context.counters.record({
                trafficClass: context.trafficClass,
                capability: 'read',
                memoHit: true
            });
        return value;
    }
    const pending = args.load();
    scope.values.set(args.key, pending);
    try {
        const value = await pending;
        if (isProviderRead(value))
            throw new Error(
                'Stamped ProviderRead values must be shared through shareProviderReadForAct'
            );
        return value;
    } catch (error) {
        if (scope.values.get(args.key) === pending) scope.values.delete(args.key);
        throw error;
    }
}

/**
 * Share raw provider inputs via `memoizeInProviderReadScope` (adapter only). A
 * stamped `ProviderRead` may be shared only through this function, only for the
 * same act object, and never across acts (INV:D17, spec §6.2 decision 2026-11-03).
 * Its only consumer is `readChargeForAct`. Outside a scope the read stays live.
 */
export async function shareProviderReadForAct<T>(args: {
    readonly act: ActStart;
    readonly key: string;
    readonly read: () => Promise<ProviderRead<T>>;
}): Promise<ProviderRead<T>> {
    let actId = actIds.get(args.act);
    if (actId === undefined) {
        actId = ++nextActId;
        actIds.set(args.act, actId);
    }
    const key = `provider-read-for-act:${actId}:${args.key}`;
    const scope = scopeStorage.getStore();
    if (!scope) return await args.read();
    const existing = scope.values.get(key);
    if (existing) {
        const context = currentTrafficContext();
        if (context?.counters)
            context.counters.record({
                trafficClass: context.trafficClass,
                capability: 'read',
                memoHit: true
            });
        return (await existing) as ProviderRead<T>;
    }
    const pending = args.read();
    scope.values.set(key, pending);
    try {
        return await pending;
    } catch (error) {
        if (scope.values.get(key) === pending) scope.values.delete(key);
        throw error;
    }
}
