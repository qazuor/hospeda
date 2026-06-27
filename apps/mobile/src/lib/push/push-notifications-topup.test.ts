/**
 * @file push-notifications-topup.test.ts
 * @description Top-up tests for the remaining uncovered lines in push-notifications.ts.
 *
 * ## Scope
 *
 * Lines 51-57 contain the `setNotificationHandler` call with a `handleNotification`
 * callback. The existing `push-notifications.test.ts` mocks `setNotificationHandler`
 * and verifies it was called, but never invokes the callback itself. This file
 * captures the callback and asserts its return value: the `NotificationBehavior`
 * object that controls how foreground notifications are presented.
 *
 * All native modules are mocked — no real device or Expo runtime required.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------

const {
    mockSetNotificationHandler,
    mockGetPermissionsAsync,
    mockRequestPermissionsAsync,
    mockGetExpoPushTokenAsync,
    mockApiFetch,
    mockExpoConfig,
    mockPlatformRef
} = vi.hoisted(() => {
    const mockExpoConfig: { extra?: Record<string, unknown> } = {};
    const mockPlatformRef = { OS: 'ios' };
    return {
        mockSetNotificationHandler: vi.fn(),
        mockGetPermissionsAsync: vi.fn(),
        mockRequestPermissionsAsync: vi.fn(),
        mockGetExpoPushTokenAsync: vi.fn(),
        mockApiFetch: vi.fn(),
        mockExpoConfig,
        mockPlatformRef
    };
});

vi.mock('expo-notifications', () => ({
    setNotificationHandler: mockSetNotificationHandler,
    getPermissionsAsync: mockGetPermissionsAsync,
    requestPermissionsAsync: mockRequestPermissionsAsync,
    getExpoPushTokenAsync: mockGetExpoPushTokenAsync
}));

vi.mock('expo-constants', () => ({
    default: {
        get expoConfig() {
            return mockExpoConfig;
        }
    }
}));

vi.mock('react-native', () => ({
    Platform: {
        get OS() {
            return mockPlatformRef.OS;
        }
    }
}));

vi.mock('../api/client', () => ({
    apiFetch: mockApiFetch
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks are declared)
// ---------------------------------------------------------------------------

// Importing the module triggers the module-scope setNotificationHandler call.
// We need to capture the handler object that was passed.
// eslint-disable-next-line import/order
import './push-notifications';

// ---------------------------------------------------------------------------
// handleNotification callback
// ---------------------------------------------------------------------------

describe('push-notifications — foreground notification handler', () => {
    beforeEach(() => {
        // setNotificationHandler was called once at module-load time (import above).
        // We do not need to reset mocks here — we just inspect the captured args.
    });

    it('calls setNotificationHandler exactly once at module load time', () => {
        expect(mockSetNotificationHandler).toHaveBeenCalledOnce();
    });

    it('passes a handler object with a handleNotification async function', () => {
        const [handlerArg] = mockSetNotificationHandler.mock.calls[0] as [
            { handleNotification: () => Promise<unknown> }
        ];
        expect(typeof handlerArg).toBe('object');
        expect(typeof handlerArg.handleNotification).toBe('function');
    });

    describe('handleNotification callback return value', () => {
        /**
         * Extract the handleNotification function that was passed to
         * setNotificationHandler at module-load time.
         */
        const getHandleNotification = (): (() => Promise<{
            shouldShowBanner: boolean;
            shouldShowList: boolean;
            shouldPlaySound: boolean;
            shouldSetBadge: boolean;
        }>) => {
            const [handlerArg] = mockSetNotificationHandler.mock.calls[0] as [
                {
                    handleNotification: () => Promise<{
                        shouldShowBanner: boolean;
                        shouldShowList: boolean;
                        shouldPlaySound: boolean;
                        shouldSetBadge: boolean;
                    }>;
                }
            ];
            return handlerArg.handleNotification;
        };

        it('returns shouldShowBanner: true', async () => {
            const handleNotification = getHandleNotification();
            const result = await handleNotification();
            expect(result.shouldShowBanner).toBe(true);
        });

        it('returns shouldShowList: true', async () => {
            const handleNotification = getHandleNotification();
            const result = await handleNotification();
            expect(result.shouldShowList).toBe(true);
        });

        it('returns shouldPlaySound: false (silent notifications)', async () => {
            const handleNotification = getHandleNotification();
            const result = await handleNotification();
            expect(result.shouldPlaySound).toBe(false);
        });

        it('returns shouldSetBadge: false (no badge updates)', async () => {
            const handleNotification = getHandleNotification();
            const result = await handleNotification();
            expect(result.shouldSetBadge).toBe(false);
        });

        it('returns a promise (handleNotification is async)', async () => {
            const handleNotification = getHandleNotification();
            const returnValue = handleNotification();
            expect(returnValue).toBeInstanceOf(Promise);
            await returnValue; // must resolve without throwing
        });
    });
});
