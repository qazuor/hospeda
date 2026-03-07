/**
 * Redis client singleton for the API server.
 * Provides a lazy-initialized Redis connection with graceful error handling.
 * Falls back to undefined when HOSPEDA_REDIS_URL is not configured.
 */
import type Redis from 'ioredis';
import { env } from './env';
import { apiLogger } from './logger';

let redisClient: Redis | undefined;
let connectionAttempted = false;

/**
 * Returns the shared Redis client instance, creating it on first call.
 * Returns undefined if HOSPEDA_REDIS_URL is not set or connection fails.
 */
export const getRedisClient = async (): Promise<Redis | undefined> => {
    if (redisClient) return redisClient;
    if (connectionAttempted) return undefined;

    connectionAttempted = true;

    const redisUrl = env.HOSPEDA_REDIS_URL;
    if (!redisUrl) {
        apiLogger.info(
            'Redis not configured (HOSPEDA_REDIS_URL not set). Using in-memory fallbacks.'
        );
        return undefined;
    }

    try {
        const { default: RedisConstructor } = await import('ioredis');
        const client = new RedisConstructor(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times: number) {
                if (times > 5) return null;
                return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
            enableReadyCheck: true,
            connectTimeout: 5000
        });

        client.on('error', (err) => {
            apiLogger.warn({ message: 'Redis connection error', error: String(err) });
        });

        client.on('connect', () => {
            apiLogger.info('Redis connected successfully');
        });

        await client.connect();
        redisClient = client;
        return client;
    } catch (error) {
        apiLogger.warn({
            message: 'Failed to connect to Redis. Falling back to in-memory store.',
            error: error instanceof Error ? error.message : String(error)
        });
        return undefined;
    }
};

/**
 * Disconnects the Redis client if connected. Used for graceful shutdown.
 */
export const disconnectRedis = async (): Promise<void> => {
    if (redisClient) {
        await redisClient.quit();
        redisClient = undefined;
        connectionAttempted = false;
    }
};

/**
 * Resets the connection state. Used for testing.
 */
export const resetRedisState = (): void => {
    redisClient = undefined;
    connectionAttempted = false;
};
