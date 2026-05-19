/**
 * Billing test fixtures barrel (SPEC-143 T-143-06).
 *
 * Single import surface for the three focused fixture modules:
 *
 * - `./webhook-events` — MP IPN payload builders (what the endpoint receives).
 * - `./mp-responses` — MP API response shapes (what the stub adapter returns).
 * - `./signature-helpers` — HMAC-SHA256 webhook signing for `x-signature`.
 *
 * Import shape in a test:
 *
 * ```ts
 * import {
 *     webhookEventFixtures,
 *     mpApiResponseFixtures,
 *     signWebhookPayload,
 *     invalidSignatureHeaders
 * } from '../../helpers/billing-fixtures';
 * ```
 *
 * @module test/e2e/helpers/billing-fixtures
 */

export * from './webhook-events.js';
export * from './mp-responses.js';
export * from './signature-helpers.js';
