/**
 * @file push-notifications.test.ts
 * @description Unit tests for push notification registration logic.
 *
 * Coverage for SPEC-243 T-011:
 * - `mapPlatform` maps Platform.OS → 'ios' | 'android' | 'web'
 * - `registerPushToken` gracefully degrades on:
 *   - permission denied → { registered: false, reason: 'permission-denied' }
 *   - missing EAS projectId → { registered: false, reason: 'no-project-id' }
 *   - apiFetch throws → { registered: false, reason: <error message> }
 * - `registerPushToken` happy path → calls apiFetch with correct args → { registered: true }
 *
 * All native modules and the api client are mocked — no real network or device
 * access is required.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables — must be declared via vi.hoisted() so they are
// available when vi.mock factories are evaluated (factories are hoisted to the
// top of the file by vitest, before regular variable declarations).
// ---------------------------------------------------------------------------

const {
    mockGetPermissionsAsync,
    mockRequestPermissionsAsync,
    mockGetExpoPushTokenAsync,
    mockSetNotificationHandler,
    mockApiFetch,
    mockExpoConfig,
    mockPlatformRef
} = vi.hoisted(() => {
    const mockExpoConfig: { extra?: Record<string, unknown> } = {};
    const mockPlatformRef = { OS: 'ios' };
    return {
        mockGetPermissionsAsync: vi.fn(),
        mockRequestPermissionsAsync: vi.fn(),
        mockGetExpoPushTokenAsync: vi.fn(),
        mockSetNotificationHandler: vi.fn(),
        mockApiFetch: vi.fn(),
        mockExpoConfig,
        mockPlatformRef
    };
});

/**
 * Mock for expo-notifications.
 * We control permission status and push token per-test via the hoisted fns.
 */
vi.mock('expo-notifications', () => ({
    setNotificationHandler: mockSetNotificationHandler,
    getPermissionsAsync: mockGetPermissionsAsync,
    requestPermissionsAsync: mockRequestPermissionsAsync,
    getExpoPushTokenAsync: mockGetExpoPushTokenAsync
}));

/**
 * Mock for expo-constants — lets us control `expoConfig.extra.eas.projectId`.
 */
vi.mock('expo-constants', () => ({
    default: {
        get expoConfig() {
            return mockExpoConfig;
        }
    }
}));

/**
 * Mock for react-native Platform — lets us control Platform.OS per-test via
 * `mockPlatformRef.OS`.
 */
vi.mock('react-native', () => ({
    Platform: {
        get OS() {
            return mockPlatformRef.OS;
        }
    }
}));

/**
 * Mock for the api client — lets us control apiFetch behaviour per-test.
 */
vi.mock('../api/client', () => ({
    apiFetch: mockApiFetch
}));

// ---------------------------------------------------------------------------
// Module under test (imported AFTER mocks are set up)
// ---------------------------------------------------------------------------

// We use a dynamic import inside beforeEach to pick up the mocked modules.
// Because vitest hoists vi.mock calls, static imports also work, but we need
// the module to re-evaluate Platform.OS each time mapPlatform() is called,
// which is done via the getter mock above.

import { mapPlatform, registerPushToken } from './push-notifications';

// ---------------------------------------------------------------------------
// mapPlatform tests
// ---------------------------------------------------------------------------

describe('mapPlatform', () => {
    afterEach(() => {
        mockPlatformRef.OS = 'ios'; // reset to default
    });

    it("returns 'ios' when Platform.OS is 'ios'", () => {
        // Arrange
        mockPlatformRef.OS = 'ios';
        // Act
        const result = mapPlatform();
        // Assert
        expect(result).toBe('ios');
    });

    it("returns 'android' when Platform.OS is 'android'", () => {
        // Arrange
        mockPlatformRef.OS = 'android';
        // Act
        const result = mapPlatform();
        // Assert
        expect(result).toBe('android');
    });

    it("returns 'web' when Platform.OS is 'web'", () => {
        // Arrange
        mockPlatformRef.OS = 'web';
        // Act
        const result = mapPlatform();
        // Assert
        expect(result).toBe('web');
    });

    it("returns 'web' for an unknown platform OS", () => {
        // Arrange
        mockPlatformRef.OS = 'windows';
        // Act
        const result = mapPlatform();
        // Assert
        expect(result).toBe('web');
    });
});

// ---------------------------------------------------------------------------
// registerPushToken tests
// ---------------------------------------------------------------------------

describe('registerPushToken', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: iOS, permissions granted, projectId set, token available
        mockPlatformRef.OS = 'ios';
        mockExpoConfig.extra = { eas: { projectId: 'test-project-id-123' } };
        mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test-token]' });
        mockApiFetch.mockResolvedValue({ data: { registered: true } });
    });

    // --- Permission denied ---

    it('returns { registered: false, reason: permission-denied } when permission is denied', async () => {
        // Arrange
        mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
        mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });
        // Act
        const result = await registerPushToken();
        // Assert
        expect(result).toEqual({ registered: false, reason: 'permission-denied' });
        expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
        expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('requests permission when current status is undetermined, then denies', async () => {
        // Arrange
        mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
        mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });
        // Act
        const result = await registerPushToken();
        // Assert
        expect(result).toEqual({ registered: false, reason: 'permission-denied' });
        expect(mockRequestPermissionsAsync).toHaveBeenCalledOnce();
        expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    // --- Missing projectId ---

    it('returns { registered: false, reason: no-project-id } when eas.projectId is absent', async () => {
        // Arrange — no `eas` key in extra
        mockExpoConfig.extra = {};
        // Act
        const result = await registerPushToken();
        // Assert
        expect(result).toEqual({ registered: false, reason: 'no-project-id' });
        expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
        expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('returns { registered: false, reason: no-project-id } when extra itself is absent', async () => {
        // Arrange
        mockExpoConfig.extra = undefined;
        // Act
        const result = await registerPushToken();
        // Assert
        expect(result).toEqual({ registered: false, reason: 'no-project-id' });
        expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it('returns { registered: false, reason: no-project-id } when projectId is not a string', async () => {
        // Arrange
        mockExpoConfig.extra = { eas: { projectId: 42 } };
        // Act
        const result = await registerPushToken();
        // Assert
        expect(result).toEqual({ registered: false, reason: 'no-project-id' });
        expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    // --- apiFetch throws ---

    it('returns { registered: false, reason: <error> } when apiFetch throws', async () => {
        // Arrange
        mockApiFetch.mockRejectedValue(new Error('Network request failed'));
        // Act
        const result = await registerPushToken();
        // Assert
        expect(result).toEqual({ registered: false, reason: 'Network request failed' });
        // apiFetch was still called (token was obtained)
        expect(mockGetExpoPushTokenAsync).toHaveBeenCalledOnce();
        expect(mockApiFetch).toHaveBeenCalledOnce();
    });

    it('does not throw to the caller even when apiFetch throws', async () => {
        // Arrange
        mockApiFetch.mockRejectedValue(new Error('Server error'));
        // Act + Assert (must not throw)
        await expect(registerPushToken()).resolves.toMatchObject({ registered: false });
    });

    // --- Happy path ---

    it('calls apiFetch with the correct path, method, body and schema on success', async () => {
        // Arrange
        mockPlatformRef.OS = 'android';
        const { PushTokenRegisterResponseSchema } = await import('@repo/schemas');
        // Act
        const result = await registerPushToken();
        // Assert
        expect(result).toEqual({ registered: true });
        expect(mockApiFetch).toHaveBeenCalledOnce();
        expect(mockApiFetch).toHaveBeenCalledWith({
            path: '/api/v1/protected/profile/push-token',
            method: 'POST',
            body: {
                token: 'ExponentPushToken[test-token]',
                platform: 'android'
            },
            schema: PushTokenRegisterResponseSchema
        });
    });

    it('does not re-request permissions when already granted', async () => {
        // Arrange
        mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
        // Act
        await registerPushToken();
        // Assert
        expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('passes the projectId to getExpoPushTokenAsync', async () => {
        // Arrange
        mockExpoConfig.extra = { eas: { projectId: 'my-eas-project' } };
        // Act
        await registerPushToken();
        // Assert
        expect(mockGetExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'my-eas-project' });
    });

    it('returns { registered: false } without throwing when getExpoPushTokenAsync throws', async () => {
        // Arrange
        mockGetExpoPushTokenAsync.mockRejectedValue(new Error('Token fetch error'));
        // Act
        const result = await registerPushToken();
        // Assert — caught by catch-all, never throws
        expect(result).toMatchObject({ registered: false });
        expect(mockApiFetch).not.toHaveBeenCalled();
    });
});
