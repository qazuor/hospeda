/**
 * Admin view-stats routes (SPEC-197 T-008–T-011).
 *
 * Registers four read-only analytics endpoints under `/api/v1/admin/views/`:
 *
 *   GET /summary      — Platform-wide totals per entity type (T-008)
 *   GET /batch        — Stats for a caller-supplied batch of entity IDs (T-009)
 *   GET /top          — Top-N most-viewed entities for a given type (T-010)
 *   GET /daily-series — 30-day daily series, 90 rows, gap-filled (T-011)
 *
 * All routes require `ANALYTICS_VIEW` permission. No billing gate is needed —
 * these are admin-tier routes gated solely by permission.
 *
 * Mount point in the main API router: `/api/v1/admin/views`
 *
 * @module routes/views/admin
 * @see SPEC-197 T-008, T-009, T-010, T-011
 */

import { createRouter } from '../../../utils/create-app';
import { adminViewBatchRoute } from './batch';
import { adminViewDailySeriesRoute } from './daily-series';
import { adminViewSummaryRoute } from './summary';
import { adminViewTopRoute } from './top';

const app = createRouter();

// T-008: Platform-wide summary
app.route('/', adminViewSummaryRoute);

// T-009: Batch entity stats
app.route('/', adminViewBatchRoute);

// T-010: Top-N most-viewed entities
app.route('/', adminViewTopRoute);

// T-011: 30-day daily series
app.route('/', adminViewDailySeriesRoute);

export { app as adminViewsRoutes };
