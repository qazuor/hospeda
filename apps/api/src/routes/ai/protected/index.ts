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
 *   accommodation field. Burst rate limits and usage metering remain active.
 * - `protectedAiChatRoute` — POST /chat (SPEC-200)
 *   Accommodation assistant streaming SSE with burst rate limits and metering.
 * - `protectedAiSearchChatRoute` — POST /search-chat (SPEC-212)
 *   Multi-turn conversational accommodation search streaming SSE.
 *   Available to authenticated users with burst rate limits and metering.
 *
 * When a sibling spec lands its handler file, ADD a new `app.route('/', ...)`
 * line below — do NOT recreate the barrel.
 *
 * @module apps/api/routes/ai/protected
 */

import { createRouter } from '../../../utils/create-app';
import { protectedAiChatRoute } from './chat';
import { protectedAiSearchChatRoute } from './search-chat';
import { protectedAiTextImproveRoute } from './text-improve';
import { protectedAiTranslateRoute } from './translate';

const app = createRouter();

// ─── Wired routes ────────────────────────────────────────────────────────────

// POST /text-improve — AI text improvement for HOST accommodation fields
// (SPEC-198). See ./text-improve.ts for the middleware stack + handler details.
app.route('/text-improve', protectedAiTextImproveRoute);

// SPEC-200 — chat AI (POST /chat)
app.route('/chat', protectedAiChatRoute);

// SPEC-212 — conversational search AI (POST /search-chat)
app.route('/search-chat', protectedAiSearchChatRoute);

// SPEC-212 — AI content translation (POST /translate)
app.route('/translate', protectedAiTranslateRoute);

export { app as protectedAiRoutes };
