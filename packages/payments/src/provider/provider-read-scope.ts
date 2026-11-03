import { AsyncLocalStorage } from 'node:async_hooks';
import { currentTrafficContext } from './traffic-context';

interface ProviderReadScope {
    readonly values: Map<string, Promise<unknown>>;
}

const scopeStorage = new AsyncLocalStorage<ProviderReadScope>();

/** Run asynchronous provider reads in a new independent memo scope. */
export async function runWithProviderReadScope<T>(args: {
    readonly fn: () => Promise<T>;
}): Promise<T> {
    return await scopeStorage.run({ values: new Map() }, args.fn);
}

/**
 * Share a raw provider input promise within the active scope. Only fulfilled
 * inputs remain cached; stamped ProviderRead values must never be stored here
 * (INV:D17).
 */
export async function memoizeInProviderReadScope<T>(args: {
    readonly key: string;
    readonly load: () => Promise<T>;
}): Promise<T> {
    const scope = scopeStorage.getStore();
    if (!scope) return await args.load();
    const existing = scope.values.get(args.key);
    if (existing) {
        const context = currentTrafficContext();
        if (context?.counters)
            context.counters.record({
                trafficClass: context.trafficClass,
                capability: 'read',
                memoHit: true
            });
        return (await existing) as T;
    }
    const pending = args.load();
    scope.values.set(args.key, pending);
    try {
        return await pending;
    } catch (error) {
        if (scope.values.get(args.key) === pending) scope.values.delete(args.key);
        throw error;
    }
}
