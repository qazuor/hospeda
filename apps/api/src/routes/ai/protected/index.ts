/**
 * Protected AI route barrel (SPEC-198 T-004; SPEC-199, SPEC-200 pending).
 *
 * Mounted at `/api/v1/protected/ai/*` by `apps/api/src/routes/index.ts`.
 * Each sub-route is a self-contained Hono sub-app produced by a
 * `create*StreamingRoute` factory — wiring more routes is additive (one
 * `app.route('/', ...)` line per new feature).
 *
 * ## Current members
 *
 * - `protectedAiTextImproveRoute` — POST /text-improve (SPEC-198)
 *   Streams an SSE response of incremental text suggestions for a HOST
 *   accommodation field. Gated by `ai_text_improve` entitlement +
 *   `max_ai_text_improve_per_month` quota.
 * - `searchIntentRoute` — POST /search-intent (SPEC-199)
 *   Converts a free-form NL query into structured filter parameters.
 *   Platform-governed (auth + rate-limit only, no billing entitlement gate).
 * - `protectedAiChatRoute` — POST /chat (SPEC-200)
 *   Accommodation assistant streaming SSE. Gated by the listing owner's
 *   `ai_chat` billing entitlement and per-owner monthly quota (SPEC-211).
 * - `protectedAiSearchChatRoute` — POST /search-chat (SPEC-212 T-004)
 *   Multi-turn conversational accommodation search streaming SSE.
 *   Platform-governed (same governance model as /search-intent).
 *
 * When a sibling spec lands its handler file, ADD a new `app.route('/', ...)`
 * line below — do NOT recreate the barrel.
 *
 * @module apps/api/routes/ai/protected
 */

import { createRouter } from '../../../utils/create-app';
import { protectedAiChatRoute } from './chat';
import { protectedAiSearchChatRoute } from './search-chat';
import { searchIntentRoute } from './search-intent';
import { protectedAiTextImproveRoute } from './text-improve';

const app = createRouter();

// ─── Wired routes ────────────────────────────────────────────────────────────

// POST /text-improve — AI text improvement for HOST accommodation fields
// (SPEC-198). See ./text-improve.ts for the middleware stack + handler details.
app.route('/text-improve', protectedAiTextImproveRoute);

// SPEC-199 — search-intent AI (POST /search-intent)
app.route('/search-intent', searchIntentRoute);

// SPEC-200 — chat AI (POST /chat)
app.route('/chat', protectedAiChatRoute);

// SPEC-212 — conversational search AI (POST /search-chat)
app.route('/search-chat', protectedAiSearchChatRoute);

export { app as protectedAiRoutes };
