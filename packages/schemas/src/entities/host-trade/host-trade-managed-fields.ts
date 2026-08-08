/**
 * @file host-trade-managed-fields.ts
 * @description The HOS-376 fields no client may ever set, named explicitly.
 *
 * Same mechanism and same reason as {@link HOST_TRADE_OWNER_FORBIDDEN_FIELDS}:
 * the write schemas already protect these by ABSENCE — a field they do not
 * declare cannot be set — but absence is invisible. Nothing breaks when someone
 * widens a schema by one field, unless the list it violates is written down and
 * a guard reads it. `host-trade-managed-fields.guard.test.ts` is that guard.
 *
 * The two lists are complementary, not redundant. That one is about a
 * provider's IDENTITY on his own listing (name, category, who owns it). This
 * one is about STATE the server derives: who confirmed what, what moderation
 * decided, and the counters computed from both.
 */

/**
 * Every server-managed field across the four tables of the domain.
 *
 * Grouped by what would break if a client could set it.
 *
 * The `host_trades` aggregates and suspension columns are listed even though
 * they are not on `HostTradeSchema` yet — they exist in the database (T-009)
 * but the Zod entity still lags. That gap is exactly why they belong here now:
 * `CreateHostTradeSchema` is built by omitting audit fields from the entity
 * rather than by allowlisting, so the day those columns reach the Zod schema
 * they flow into the admin create body unless somebody omits them. Listed
 * ahead of time, that day produces a red test instead of a silent widening.
 */
export const HOST_TRADE_DOMAIN_MANAGED_FIELDS = [
    // ---- Usage state machine (§6.2) -------------------------------------
    // A declaration is worth something only because the OTHER party resolved
    // it. A client that could write these would confirm its own usage, which
    // is the single thing this domain exists to prevent.
    'status',
    'expiresAt',
    'reminderSentAt',
    'confirmedAt',
    'confirmedById',
    'rejectedAt',
    'rejectedById',

    // ---- Moderation (§6.4) ----------------------------------------------
    // `moderationState` is what keeps a reply out of the directory until an
    // admin clears it, and what `moderateText()` flips on a review that scores
    // high. Settable from a body, both become decorative.
    'moderationState',
    'moderatedById',
    'moderatedAt',
    'moderationReason',

    // `editedAt` marks a host's edit and `reviewEditedAfterReply` is the banner
    // saying a provider's reply answers an older version of the text (AC-22).
    // Either one under client control erases that notice.
    'editedAt',
    'reviewEditedAfterReply',

    // ---- Denormalised aggregates on host_trades (§7.2) -------------------
    // Recomputed from the rows themselves. A writable counter is a provider
    // typing his own reputation — and `distinctHostsCount` in particular is the
    // anti-collusion signal that makes "40 usos · 2 anfitriones" readable.
    'confirmedUsesCount',
    'distinctHostsCount',
    'reviewsCount',
    'averageRating',
    'benefitRespectedCount',

    // ---- Declaration suspension (§6.5) -----------------------------------
    // Applied by the rejection-threshold cron or lifted by an admin (AC-11 /
    // AC-12). A provider who could clear his own suspension would not have one.
    'declarationSuspendedAt',
    'declarationSuspendedById',
    'declarationSuspendReason'
] as const;

/** One of the server-managed field names. */
export type HostTradeDomainManagedField = (typeof HOST_TRADE_DOMAIN_MANAGED_FIELDS)[number];
