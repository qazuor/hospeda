/**
 * @module services/conversation
 *
 * Conversation domain services for the guest-owner messaging system (SPEC-085).
 *
 * Exported services:
 * - `AccessTokenService` — anonymous-guest access token lifecycle (generate, validate, revoke, remind).
 * - `NotificationScheduleService` — email notification scheduling and streak management.
 *
 * Additional services (T-007, T-008, …) will be appended to this barrel as they are implemented.
 */

export type { GenerateTokenResult } from './access-token.service';
export * from './access-token.service';
export * from './conversation.permissions.js';
export * from './conversation.service.js';
export type { GetMessagesResult } from './message.service.js';
export * from './message.service.js';
export type { AdvanceScheduleResult } from './notification-schedule.service';
export * from './notification-schedule.service';
