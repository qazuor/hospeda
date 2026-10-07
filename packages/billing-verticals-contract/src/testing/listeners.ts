/**
 * A small in-memory listener registry the two simulators share.
 */
import type { ContractListener, Unsubscribe } from '../interfaces';

/** The listeners of one event, and how to deliver to all of them. */
export interface ListenerRegistry<TEvent> {
    /** Registers a listener; the returned function removes it. */
    readonly add: (listener: ContractListener<TEvent>) => Unsubscribe;
    /** Delivers one event to every listener and waits for all of them. */
    readonly deliver: (args: { readonly event: TEvent }) => Promise<void>;
}

/**
 * Creates an empty registry.
 *
 * @returns `{ registry }`
 */
export function createListenerRegistry<TEvent>(): { readonly registry: ListenerRegistry<TEvent> } {
    const listeners = new Set<ContractListener<TEvent>>();
    return {
        registry: {
            add: (listener) => {
                listeners.add(listener);
                return () => {
                    listeners.delete(listener);
                };
            },
            deliver: async ({ event }) => {
                await Promise.all([...listeners].map(async (listener) => listener(event)));
            }
        }
    };
}
