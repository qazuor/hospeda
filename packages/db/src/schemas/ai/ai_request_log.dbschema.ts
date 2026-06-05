import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * AI request audit log (SPEC-173 T-006).
 *
 * Stores PII-scrubbed request metadata for debugging (§5.13). This table is
 * NOT the conversations/messages store — it is a low-level debugging trail
 * covering every AI call regardless of feature.
 *
 * **PII policy (§5.10):** emails, phone numbers, payment card numbers, and
 * any other PII are redacted BEFORE storing in `requestMetadata`. The raw
 * conversation text is NOT stored here (it lives in `ai_messages`).
 *
 * **APPEND-ONLY debug log** (owner-approved 2026-06-04): rows are immutable
 * audit records — no soft-delete (`deletedAt`/`deletedById`), no `updatedAt`.
 * This matches the pattern of `cron_runs`, `app_log`, and `ai_credential_audit`.
 * A deleted user's log rows survive (anonymised) via `userId` nullable +
 * `ON DELETE SET NULL`.
 *
 * The `feature` and `provider` columns store AI identifiers as varchar.
 * Decision (owner-approved 2026-06-04): varchar chosen for AI enums (consistent
 * with repo — pgEnum is reserved for TS enums in @repo/schemas; AI values are
 * z.enum). Migrating to pgEnum is a future option if these are ever promoted to
 * TS enums.
 */
export const aiRequestLog = pgTable(
    'ai_request_log',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /**
         * FK → users.id. The authenticated user who triggered the request.
         * Nullable for system-initiated calls (e.g. batch operations) or
         * if the request was rejected before actor resolution.
         * ON DELETE SET NULL: preserve the log row when a user is removed.
         */
        userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

        /**
         * AI feature that was invoked.
         * Values: `text_improve` | `chat` | `search` | `support`
         */
        feature: varchar('feature', { length: 50 }).notNull(),

        /**
         * Provider that served or attempted the call.
         * Values: `openai` | `anthropic` | `stub`
         */
        provider: varchar('provider', { length: 50 }).notNull(),

        /**
         * PII-scrubbed request metadata (JSONB).
         * May include: sanitised input excerpt, model, params, request id,
         * trace id, fallback chain info, error code. Emails/phones/cards
         * MUST be redacted by the caller before storing.
         */
        requestMetadata: jsonb('request_metadata').$type<Record<string, unknown>>().notNull(),

        // ---- Timestamp (creation only — APPEND-ONLY, no updatedAt, no deletedAt) ----
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (table) => ({
        /**
         * Primary browse path: debugging queries by feature + time.
         * Also covers purge-by-age operations (retention policy TBD per §5.13).
         */
        aiRequestLog_feature_created_idx: index('aiRequestLog_feature_created_idx').on(
            table.feature,
            table.createdAt.desc()
        ),

        /**
         * Per-user request history for abuse investigation.
         */
        aiRequestLog_userId_created_idx: index('aiRequestLog_userId_created_idx').on(
            table.userId,
            table.createdAt.desc()
        )
    })
);

/** Drizzle relations for `ai_request_log`. */
export const aiRequestLogRelations = relations(aiRequestLog, ({ one }) => ({
    user: one(users, {
        fields: [aiRequestLog.userId],
        references: [users.id]
    })
}));

/** Type inference helpers. */
export type InsertAiRequestLog = typeof aiRequestLog.$inferInsert;
export type SelectAiRequestLog = typeof aiRequestLog.$inferSelect;
