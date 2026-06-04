/**
 * Tests for ai-service.factory (SPEC-173 T-043).
 *
 * ## Coverage
 *
 * 1. `createConfiguredAiService` decrypts openai + anthropic credentials and
 *    passes them to `createAiService`.
 * 2. `buildGetProvider` returns `OpenAiAdapter` when a key is present for 'openai'.
 * 3. `buildGetProvider` returns `AnthropicAdapter` when a key is present for 'anthropic'.
 * 4. `buildGetProvider` returns `StubProvider` for 'stub' regardless of keyMap.
 * 5. `buildGetProvider` throws for a provider with no key in the map.
 * 6. `buildGetProvider` throws for an unknown provider ID.
 * 7. The `checkCeiling` passed to `createAiService` composes `checkCostCeiling`
 *    with the alert hook (calling it invokes `checkCostCeiling` with `onThresholdAlert` set).
 * 8. `getNow` returns a `Date` instance.
 * 9. `recordEvent` does not throw and calls `apiLogger.debug`.
 * 10. Plaintext key is never passed to `apiLogger` in any call.
 * 11. A missing credential for a provider is silently skipped (no throw).
 *
 * @module test/services/ai-service.factory
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Typed captured-input shape (used by the mock to record what createAiService
// received — gives tests typed dot-notation access to the injected fields).
// ---------------------------------------------------------------------------

interface CapturedAiServiceInput {
    getProvider: ((id: string) => unknown) | undefined;
    checkCeiling: ((input: { feature: string; now: Date }) => Promise<void>) | undefined;
    getNow: (() => Date) | undefined;
    recordEvent:
        | ((event: { type: string; feature?: string; providerId?: string }) => void)
        | undefined;
    defaultLocale: string | undefined;
}

// ---------------------------------------------------------------------------
// Hoisted mock state (vi.hoisted must run before vi.mock factories)
// ---------------------------------------------------------------------------

const {
    mockCreateAiService,
    mockGetDecryptedAiProviderCredential,
    mockCheckCostCeiling,
    mockCreateAiCostThresholdAlertHook,
    mockOpenAiAdapterConstructor,
    mockAnthropicAdapterConstructor,
    mockStubProviderConstructor,
    mockApiLogger,
    capturedCreateAiServiceInput
} = vi.hoisted(() => {
    // Capture the input passed to createAiService so tests can inspect each field
    // with typed dot-notation access.
    const capturedCreateAiServiceInput: { current: CapturedAiServiceInput | null } = {
        current: null
    };

    const mockCreateAiService = vi.fn().mockImplementation((input: CapturedAiServiceInput) => {
        capturedCreateAiServiceInput.current = input;
        // Return a minimal AiService-shaped object.
        return {
            engine: {},
            generateText: vi.fn(),
            generateObject: vi.fn(),
            extractIntent: vi.fn(),
            moderate: vi.fn(),
            embed: vi.fn()
        };
    });

    const mockGetDecryptedAiProviderCredential = vi.fn().mockResolvedValue({
        data: { providerId: 'openai', plaintextKey: 'sk-test-openai-key' }
    });

    const mockCheckCostCeiling = vi.fn().mockResolvedValue(undefined);

    const mockAlertHookFn = vi.fn();
    const mockCreateAiCostThresholdAlertHook = vi.fn().mockReturnValue(mockAlertHookFn);

    const mockOpenAiAdapterConstructor = vi.fn().mockImplementation(function (this: object) {
        Object.assign(this, { _type: 'OpenAiAdapter' });
    });
    const mockAnthropicAdapterConstructor = vi.fn().mockImplementation(function (this: object) {
        Object.assign(this, { _type: 'AnthropicAdapter' });
    });
    const mockStubProviderConstructor = vi.fn().mockImplementation(function (this: object) {
        Object.assign(this, { _type: 'StubProvider' });
    });

    const mockApiLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    };

    return {
        mockCreateAiService,
        mockGetDecryptedAiProviderCredential,
        mockCheckCostCeiling,
        mockCreateAiCostThresholdAlertHook,
        mockOpenAiAdapterConstructor,
        mockAnthropicAdapterConstructor,
        mockStubProviderConstructor,
        mockApiLogger,
        capturedCreateAiServiceInput
    };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@repo/ai-core', () => ({
    createAiService: mockCreateAiService,
    checkCostCeiling: mockCheckCostCeiling,
    OpenAiAdapter: mockOpenAiAdapterConstructor,
    AnthropicAdapter: mockAnthropicAdapterConstructor,
    StubProvider: mockStubProviderConstructor
}));

vi.mock('../../src/services/ai-credential-vault.service', () => ({
    getDecryptedAiProviderCredential: mockGetDecryptedAiProviderCredential
}));

vi.mock('../../src/services/ai-cost-alert.service', () => ({
    createAiCostThresholdAlertHook: mockCreateAiCostThresholdAlertHook
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: mockApiLogger
}));

// ---------------------------------------------------------------------------
// Import SUT (after mocks are registered)
// ---------------------------------------------------------------------------

import { buildGetProvider, createConfiguredAiService } from '../../src/services/ai-service.factory';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    capturedCreateAiServiceInput.current = null;

    // Default: openai has a key, anthropic has a key.
    mockGetDecryptedAiProviderCredential.mockImplementation(
        async ({ providerId }: { providerId: string }) => {
            if (providerId === 'openai') {
                return { data: { providerId: 'openai', plaintextKey: 'sk-test-openai-key' } };
            }
            if (providerId === 'anthropic') {
                return { data: { providerId: 'anthropic', plaintextKey: 'sk-test-anthropic-key' } };
            }
            return { error: { code: 'NOT_FOUND', message: 'not found' } };
        }
    );

    mockCheckCostCeiling.mockResolvedValue(undefined);
    mockCreateAiCostThresholdAlertHook.mockReturnValue(vi.fn());
    mockCreateAiService.mockImplementation((input: CapturedAiServiceInput) => {
        capturedCreateAiServiceInput.current = input;
        return {
            engine: {},
            generateText: vi.fn(),
            generateObject: vi.fn(),
            extractIntent: vi.fn(),
            moderate: vi.fn(),
            embed: vi.fn()
        };
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. createConfiguredAiService — end-to-end wiring
// ---------------------------------------------------------------------------

describe('createConfiguredAiService', () => {
    it('should decrypt openai and anthropic credentials during construction', async () => {
        // Arrange — handled by default mock setup.

        // Act
        await createConfiguredAiService();

        // Assert — both providers were queried.
        expect(mockGetDecryptedAiProviderCredential).toHaveBeenCalledWith({ providerId: 'openai' });
        expect(mockGetDecryptedAiProviderCredential).toHaveBeenCalledWith({
            providerId: 'anthropic'
        });
    });

    it('should call createAiService exactly once', async () => {
        // Act
        await createConfiguredAiService();

        // Assert
        expect(mockCreateAiService).toHaveBeenCalledTimes(1);
    });

    it('should pass a getProvider function to createAiService', async () => {
        // Act
        await createConfiguredAiService();

        // Assert
        expect(typeof capturedCreateAiServiceInput.current?.getProvider).toBe('function');
    });

    it('should pass checkCeiling, getNow, recordEvent and defaultLocale to createAiService', async () => {
        // Act
        await createConfiguredAiService();

        // Assert
        const input = capturedCreateAiServiceInput.current;
        expect(input).not.toBeNull();
        expect(typeof input?.checkCeiling).toBe('function');
        expect(typeof input?.getNow).toBe('function');
        expect(typeof input?.recordEvent).toBe('function');
        expect(input?.defaultLocale).toBe('es');
    });

    it('should not throw when a credential is missing for one provider', async () => {
        // Arrange — anthropic has no credential.
        mockGetDecryptedAiProviderCredential.mockImplementation(
            async ({ providerId }: { providerId: string }) => {
                if (providerId === 'openai') {
                    return { data: { providerId: 'openai', plaintextKey: 'sk-test-openai-key' } };
                }
                return { error: { code: 'NOT_FOUND', message: 'not found' } };
            }
        );

        // Act + Assert — construction should not throw.
        await expect(createConfiguredAiService()).resolves.toBeDefined();
    });

    it('should create the alert hook via createAiCostThresholdAlertHook', async () => {
        // Act
        await createConfiguredAiService();

        // Assert
        expect(mockCreateAiCostThresholdAlertHook).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// 2-6. buildGetProvider (testable seam)
// ---------------------------------------------------------------------------

describe('buildGetProvider', () => {
    it('should return an OpenAiAdapter instance for openai when a key is present', () => {
        // Arrange
        const keyMap = new Map([['openai', 'sk-test-openai-key']] as const);

        // Act
        const provider = buildGetProvider(keyMap)('openai');

        // Assert
        expect(mockOpenAiAdapterConstructor).toHaveBeenCalledWith({ apiKey: 'sk-test-openai-key' });
        expect(provider).toBeInstanceOf(mockOpenAiAdapterConstructor);
    });

    it('should return an AnthropicAdapter instance for anthropic when a key is present', () => {
        // Arrange
        const keyMap = new Map([['anthropic', 'sk-ant-test-key']] as const);

        // Act
        const provider = buildGetProvider(keyMap)('anthropic');

        // Assert
        expect(mockAnthropicAdapterConstructor).toHaveBeenCalledWith({ apiKey: 'sk-ant-test-key' });
        expect(provider).toBeInstanceOf(mockAnthropicAdapterConstructor);
    });

    it('should return a StubProvider for stub regardless of keyMap', () => {
        // Arrange — empty map (no real credentials).
        const keyMap = new Map<'openai' | 'anthropic', string>();

        // Act
        const provider = buildGetProvider(keyMap)('stub');

        // Assert
        expect(mockStubProviderConstructor).toHaveBeenCalledTimes(1);
        expect(provider).toBeInstanceOf(mockStubProviderConstructor);
    });

    it('should throw a descriptive error for a real provider with no key in the map', () => {
        // Arrange — empty map.
        const keyMap = new Map<'openai' | 'anthropic', string>();

        // Act + Assert
        expect(() => buildGetProvider(keyMap)('openai')).toThrow(
            "No AI credential configured for provider 'openai'"
        );
    });

    it('should throw for an unknown provider ID', () => {
        // Arrange — map with a value but an unrecognised provider ID.
        const keyMap = new Map([['openai', 'sk-key']] as const);

        // Act + Assert — use `as unknown as` to simulate an unknown ID at runtime
        // without introducing a typed `any`.
        expect(() => buildGetProvider(keyMap)('unknown' as unknown as 'openai')).toThrow(
            "Unknown AI provider 'unknown'"
        );
    });
});

// ---------------------------------------------------------------------------
// 7. checkCeiling composition
// ---------------------------------------------------------------------------

describe('checkCeiling composition', () => {
    it('should invoke checkCostCeiling with onThresholdAlert set when checkCeiling is called', async () => {
        // Arrange
        const alertHookFn = vi.fn();
        mockCreateAiCostThresholdAlertHook.mockReturnValue(alertHookFn);

        await createConfiguredAiService();

        const checkCeilingFn = capturedCreateAiServiceInput.current?.checkCeiling;
        expect(checkCeilingFn).toBeDefined();

        const testFeature = 'text_improve';
        const testNow = new Date('2026-06-01T00:00:00Z');

        // Act — invoke the wired checkCeiling.
        await checkCeilingFn?.({ feature: testFeature, now: testNow });

        // Assert — checkCostCeiling was called with the correct args including the hook.
        expect(mockCheckCostCeiling).toHaveBeenCalledWith({
            feature: testFeature,
            now: testNow,
            onThresholdAlert: alertHookFn
        });
    });
});

// ---------------------------------------------------------------------------
// 8. getNow
// ---------------------------------------------------------------------------

describe('getNow', () => {
    it('should return a Date instance', async () => {
        // Arrange
        await createConfiguredAiService();

        const getNowFn = capturedCreateAiServiceInput.current?.getNow;
        expect(getNowFn).toBeDefined();

        // Act
        const result = getNowFn?.();

        // Assert
        expect(result).toBeInstanceOf(Date);
    });
});

// ---------------------------------------------------------------------------
// 9. recordEvent
// ---------------------------------------------------------------------------

describe('recordEvent', () => {
    it('should not throw when recordEvent is called with a success event', async () => {
        // Arrange
        await createConfiguredAiService();

        const recordEventFn = capturedCreateAiServiceInput.current?.recordEvent;
        expect(recordEventFn).toBeDefined();

        // Act + Assert — must not throw.
        expect(() =>
            recordEventFn?.({ type: 'success', feature: 'text_improve', providerId: 'openai' })
        ).not.toThrow();
    });

    it('should call apiLogger.debug when recordEvent is invoked', async () => {
        // Arrange
        await createConfiguredAiService();

        const recordEventFn = capturedCreateAiServiceInput.current?.recordEvent;

        // Act
        recordEventFn?.({ type: 'success', feature: 'text_improve', providerId: 'openai' });

        // Assert — debug log was called (not info/warn/error).
        expect(mockApiLogger.debug).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// 10. Plaintext key never logged
// ---------------------------------------------------------------------------

describe('plaintext key safety', () => {
    it('should never pass the plaintext key to any apiLogger call', async () => {
        // Arrange
        const plaintextKey = 'sk-super-secret-key-do-not-log';
        mockGetDecryptedAiProviderCredential.mockResolvedValue({
            data: { providerId: 'openai', plaintextKey }
        });

        // Act
        await createConfiguredAiService();

        // Assert — inspect all logger calls (debug, info, warn, error).
        const allLoggerCalls = [
            ...mockApiLogger.debug.mock.calls,
            ...mockApiLogger.info.mock.calls,
            ...mockApiLogger.warn.mock.calls,
            ...mockApiLogger.error.mock.calls
        ];

        for (const callArgs of allLoggerCalls) {
            const serialised = JSON.stringify(callArgs);
            expect(serialised).not.toContain(plaintextKey);
        }
    });
});
