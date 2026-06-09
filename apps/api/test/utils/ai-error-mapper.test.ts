/**
 * Tests for {@link mapAiEngineErrorToHttpStatus} (apps/api/utils/ai-error-mapper).
 *
 * Verifies the engineCode → HTTP-status/code mapping table, including the
 * SPEC-198 `PROVIDER_UNCONFIGURED` → 503 mapping, without weakening the
 * existing mappings.
 *
 * @module test/utils/ai-error-mapper
 */

import {
    AiCeilingHitError,
    AiEngineError,
    AiFeatureDisabledError,
    AiModerationBlockedError,
    AiNoEnabledProviderError,
    AiProviderUnconfiguredError
} from '@repo/ai-core';
import { describe, expect, it } from 'vitest';
import { mapAiEngineErrorToHttpStatus } from '../../src/utils/ai-error-mapper';

describe('mapAiEngineErrorToHttpStatus', () => {
    it('should map MODERATION_BLOCKED to 422 / MODERATION_BLOCKED', () => {
        const error = new AiModerationBlockedError({
            feature: 'chat',
            direction: 'input',
            categories: { hate: true }
        });
        expect(mapAiEngineErrorToHttpStatus(error)).toEqual({
            status: 422,
            code: 'MODERATION_BLOCKED'
        });
    });

    it('should map FEATURE_DISABLED to 503 / FEATURE_DISABLED', () => {
        expect(mapAiEngineErrorToHttpStatus(new AiFeatureDisabledError('chat'))).toEqual({
            status: 503,
            code: 'FEATURE_DISABLED'
        });
    });

    it('should map CEILING_HIT to 503 / CEILING_HIT', () => {
        const error = new AiCeilingHitError({
            scope: 'global',
            spentMicroUsd: 100,
            ceilingMicroUsd: 50
        });
        expect(mapAiEngineErrorToHttpStatus(error)).toEqual({ status: 503, code: 'CEILING_HIT' });
    });

    it('should map NO_ENABLED_PROVIDER to 503 / NO_ENABLED_PROVIDER', () => {
        expect(mapAiEngineErrorToHttpStatus(new AiNoEnabledProviderError('chat'))).toEqual({
            status: 503,
            code: 'NO_ENABLED_PROVIDER'
        });
    });

    it('should map PROVIDER_UNCONFIGURED to 503 / PROVIDER_UNCONFIGURED (SPEC-198)', () => {
        const error = new AiProviderUnconfiguredError({ providerId: 'openai' });
        expect(error).toBeInstanceOf(AiEngineError);
        expect(error.engineCode).toBe('PROVIDER_UNCONFIGURED');
        expect(mapAiEngineErrorToHttpStatus(error)).toEqual({
            status: 503,
            code: 'PROVIDER_UNCONFIGURED'
        });
    });

    it('should map any other AiEngineError to 500 / <engineCode>', () => {
        const error = new AiEngineError('boom', 'SOME_UNKNOWN_CODE');
        expect(mapAiEngineErrorToHttpStatus(error)).toEqual({
            status: 500,
            code: 'SOME_UNKNOWN_CODE'
        });
    });

    it('should return undefined for non-AiEngineError values', () => {
        expect(mapAiEngineErrorToHttpStatus(new Error('plain'))).toBeUndefined();
        expect(mapAiEngineErrorToHttpStatus('string error')).toBeUndefined();
        expect(mapAiEngineErrorToHttpStatus(undefined)).toBeUndefined();
    });
});
