/**
 * @file email-pixel-config.test.ts
 * @description Boot-time warning for an unreachable email pixel origin (HOS-2359 §6.A.1).
 */
import { describe, expect, it, vi } from 'vitest';
import { checkEmailPixelBaseUrl } from '../../src/utils/email-pixel-config';

describe('checkEmailPixelBaseUrl', () => {
    it.each([
        ['production', 'http://umami:3000', 1],
        ['production', 'https://pulso.hospeda.com.ar', 0],
        ['production', undefined, 0],
        ['development', 'http://localhost:3010', 0]
    ])('NODE_ENV=%s, HOSPEDA_UMAMI_URL=%s → %i warning(s)', (nodeEnv, umamiUrl, warnings) => {
        // Arrange
        const logger = { warn: vi.fn() };

        // Act
        const result = checkEmailPixelBaseUrl({ umamiUrl, nodeEnv, logger });

        // Assert
        expect(result).toBe(umamiUrl);
        expect(logger.warn).toHaveBeenCalledTimes(warnings);
    });
});
