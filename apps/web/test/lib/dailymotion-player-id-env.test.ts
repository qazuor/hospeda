/**
 * @file dailymotion-player-id-env.test.ts
 * @description HOS-1217: PUBLIC_DAILYMOTION_PLAYER_ID is optional (unset or empty
 * means "degrade to an external link") and, when set, alphanumeric only, because
 * the value is interpolated into an iframe URL.
 */

import { describe, expect, it } from 'vitest';
import { serverEnvSchema } from '../../src/env';

const baseValid = {
    PUBLIC_API_URL: 'https://api.test',
    PUBLIC_SITE_URL: 'https://site.test',
    PUBLIC_ADMIN_URL: 'https://admin.test',
    NODE_ENV: 'development'
} as const;

describe('serverEnvSchema — PUBLIC_DAILYMOTION_PLAYER_ID (HOS-1217)', () => {
    it.each([undefined, '', 'xabc1', 'X9z'])('accepts %j', (value) => {
        const result = serverEnvSchema.safeParse({
            ...baseValid,
            PUBLIC_DAILYMOTION_PLAYER_ID: value
        });
        expect(result.success).toBe(true);
    });

    it.each(['a/b', 'x.html?evil=1', 'a b', '../x', 'a'.repeat(21)])('rejects %j', (value) => {
        const result = serverEnvSchema.safeParse({
            ...baseValid,
            PUBLIC_DAILYMOTION_PLAYER_ID: value
        });
        expect(result.success).toBe(false);
    });
});
