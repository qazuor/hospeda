/**
 * Closing the owned Redis cool-down client (HOS-2115).
 *
 * The store creates its own client after an async `import('ioredis')`. A close
 * that landed before that import resolved returned early on `!client`, and the
 * client created right after was never closed: its retry strategy never gives
 * up, so an unreachable Redis kept a reconnect timer alive and the cutover
 * script never exited.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    construct: vi.fn(),
    quit: vi.fn(),
    disconnect: vi.fn()
}));

vi.mock('ioredis', () => ({
    default: class FakeRedis {
        status = 'reconnecting';
        constructor(...args: unknown[]) {
            mocks.construct(...args);
        }
        on(): this {
            return this;
        }
        connect(): Promise<void> {
            return Promise.reject(new Error('connect ECONNREFUSED'));
        }
        quit(): Promise<string> {
            return mocks.quit();
        }
        disconnect(): void {
            mocks.disconnect();
        }
    }
}));

import { createMercadoPagoRedisCoolDownStore } from '../../src/utils/mp-cooldown-redis-store';

/** Let the store's async `import('ioredis')` and its continuation run. */
async function settleInitialization(): Promise<void> {
    for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('TEST:2115:3 Redis cool-down store close', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.quit.mockResolvedValue('OK');
    });

    it('never creates the owned client when close lands before initialization finishes', async () => {
        // Arrange
        const store = createMercadoPagoRedisCoolDownStore({ redisUrl: 'redis://127.0.0.1:1' });

        // Act
        await store.close?.();
        await settleInitialization();

        // Assert
        expect(mocks.construct).not.toHaveBeenCalled();
        expect(mocks.quit).not.toHaveBeenCalled();
    });

    it('disconnects the owned client when quit is refused while reconnecting', async () => {
        // Arrange
        mocks.quit.mockRejectedValue(new Error("Stream isn't writeable"));
        const store = createMercadoPagoRedisCoolDownStore({ redisUrl: 'redis://127.0.0.1:1' });
        await settleInitialization();
        expect(mocks.construct).toHaveBeenCalledTimes(1);

        // Act
        await store.close?.();

        // Assert
        expect(mocks.quit).toHaveBeenCalledTimes(1);
        expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    });
});
