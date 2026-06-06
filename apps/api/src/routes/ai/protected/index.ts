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
 *
 * ## Future slots (NOT YET WIRED — sibling specs in flight)
 *
 * - SPEC-199 (search-intent AI): `protectedAiSearchIntentRoute` —
 *   will mount as POST /search-intent.
 * - SPEC-200 (chat AI): `protectedAiChatRoute` — will mount as POST /chat.
 *
 * When a sibling spec lands its handler file, ADD a new `app.route('/', ...)`
 * line below — do NOT recreate the barrel.
 *
 * @module apps/api/routes/ai/protected
 */

import { createRouter } from '../../../utils/create-app';
import { protectedAiTextImproveRoute } from './text-improve';

const app = createRouter();

// ─── Wired routes ────────────────────────────────────────────────────────────

// POST /text-improve — AI text improvement for HOST accommodation fields
// (SPEC-198). See ./text-improve.ts for the middleware stack + handler details.
app.route('/text-improve', protectedAiTextImproveRoute);

// ─── Reserved slots (sibling specs, NOT YET WIRED) ──────────────────────────
//
// // SPEC-199 — search-intent AI (POST /search-intent)
// // app.route('/search-intent', protectedAiSearchIntentRoute);
//
// // SPEC-200 — chat AI (POST /chat)
// // app.route('/chat', protectedAiChatRoute);

export { app as protectedAiRoutes };
