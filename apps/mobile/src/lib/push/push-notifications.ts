/**
 * @file push-notifications.ts
 * @description Expo push notification registration for the Hospeda mobile app.
 *
 * ## Responsibilities
 * - Sets the foreground notification handler so notifications show as banners
 *   while the app is in the foreground.
 * - Requests notification permissions from the OS.
 * - Retrieves the Expo push token and POSTs it to the Hospeda API so the
 *   backend can target this device.
 *
 * ## Graceful-degrade contract
 * `registerPushToken` NEVER throws to its caller. Every failure path returns
 * `{ registered: false, reason: '<slug>' }` and logs a warning. The function
 * is safe to call unconditionally — a crash here must never crash the app.
 *
 * ## Device-gated behaviour
 * Obtaining a real Expo push token requires:
 * 1. A physical device or Android emulator (push tokens are not available in
 *    the iOS simulator).
 * 2. A valid EAS `projectId` set in `app.json` → `extra.eas.projectId` (set
 *    via `eas init`). Without this, `getExpoPushTokenAsync` throws. The
 *    function detects the absent projectId and returns early with reason
 *    `'no-project-id'` rather than crashing.
 *
 * @module push/push-notifications
 */

import { PushTokenRegisterResponseSchema } from '@repo/schemas';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiFetch } from '../api/client';

// ---------------------------------------------------------------------------
// Foreground notification handler (module-scope — runs once at import time)
// ---------------------------------------------------------------------------

/**
 * Configures how notifications are presented when the app is in the
 * foreground.
 *
 * Fields are the SDK 56 `NotificationBehavior` shape:
 * - `shouldShowBanner`  — show as a banner notification (replaces the
 *   deprecated `shouldShowAlert` from older SDK versions).
 * - `shouldShowList`    — include in the notification centre / list.
 * - `shouldPlaySound`   — play the notification sound.
 * - `shouldSetBadge`    — update the app icon badge count.
 */
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false
    })
});

// ---------------------------------------------------------------------------
// Platform helper
// ---------------------------------------------------------------------------

/**
 * Maps React Native's `Platform.OS` to the push-token platform enum expected
 * by the API (`'ios' | 'android' | 'web'`).
 *
 * Unknown platforms (e.g. 'windows', 'macos', or future values) map to `'web'`
 * as the safest fallback — the API accepts it and the registration will still
 * be attempted.
 *
 * @returns One of `'ios'`, `'android'`, or `'web'`.
 */
export function mapPlatform(): 'ios' | 'android' | 'web' {
    if (Platform.OS === 'ios') return 'ios';
    if (Platform.OS === 'android') return 'android';
    return 'web';
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * Return value of {@link registerPushToken}.
 *
 * - `registered: true`  — token successfully sent to the server.
 * - `registered: false` — registration skipped or failed; `reason` describes
 *   why (for logging / diagnostics, not for end-user display).
 */
export type RegisterPushTokenResult =
    | { readonly registered: true }
    | { readonly registered: false; readonly reason: string };

// ---------------------------------------------------------------------------
// registerPushToken
// ---------------------------------------------------------------------------

/**
 * Registers this device's Expo push token with the Hospeda API.
 *
 * ### Steps
 * 1. Check existing notification permission; request if not yet determined.
 * 2. If permission denied → return `{ registered: false, reason: 'permission-denied' }`.
 * 3. Resolve the EAS `projectId` from `Constants.expoConfig.extra.eas.projectId`.
 *    If absent → return `{ registered: false, reason: 'no-project-id' }` and
 *    log a warning (owner must run `eas init`).
 * 4. Obtain the Expo push token via `getExpoPushTokenAsync`.
 * 5. POST token + platform to `POST /api/v1/protected/profile/push-token`.
 * 6. Return `{ registered: true }` on success.
 *
 * Every failure is caught and returned as `{ registered: false, reason }` —
 * this function NEVER throws.
 *
 * @returns A promise resolving to {@link RegisterPushTokenResult}.
 */
export async function registerPushToken(): Promise<RegisterPushTokenResult> {
    try {
        // Step 1 — Check current permission status
        const { status: existingStatus } = await Notifications.getPermissionsAsync();

        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            // Step 1b — Request permission if not already granted
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        // Step 2 — Bail out if permission was denied
        if (finalStatus !== 'granted') {
            console.warn('[push] Notification permission denied.');
            return { registered: false, reason: 'permission-denied' };
        }

        // Step 3 — Resolve EAS projectId
        const easConfig = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
            ?.eas as Record<string, unknown> | undefined;

        const projectId =
            typeof easConfig?.projectId === 'string' ? easConfig.projectId : undefined;

        if (!projectId) {
            // Owner must run `eas init` to populate extra.eas.projectId in app.json.
            // getExpoPushTokenAsync throws without it — we skip gracefully instead.
            console.warn(
                '[push] EAS projectId not found in Constants.expoConfig.extra.eas.projectId. ' +
                    'Run `eas init` to configure it. Push token registration skipped.'
            );
            return { registered: false, reason: 'no-project-id' };
        }

        // Step 4 — Retrieve the Expo push token
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

        // Step 5 — POST to the Hospeda API
        await apiFetch({
            path: '/api/v1/protected/profile/push-token',
            method: 'POST',
            body: { token, platform: mapPlatform() },
            schema: PushTokenRegisterResponseSchema
        });

        // Step 6 — Success
        return { registered: true };
    } catch (error) {
        // Catch-all: network failure, token fetch failure, API error, etc.
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[push] Push token registration failed:', message);
        return { registered: false, reason: message };
    }
}
