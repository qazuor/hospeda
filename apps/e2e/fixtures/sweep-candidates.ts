import {
    BEFORE_CANCEL_KIND_BY_TRANSITION,
    BEFORE_CANCEL_TEMPLATE_BY_KIND
} from '@repo/service-core';
import { execSQL } from './db-helpers.ts';

/** The global terminal populations read by the reconciliation sweep. */
export async function describeSweepCandidates(
    args: {
        readonly excludeUserIds?: readonly string[];
        readonly includeUserIds?: readonly string[];
    } = {}
) {
    const rows = await execSQL<{
        pass: string;
        subscription_id: string;
        user_id: string | null;
        email: string | null;
        status: string;
        class: string;
        created_at: Date;
        provider_id: string;
        decision_reason: string | null;
        decision_occurred_at: Date | null;
        notices: Array<{ template: string; status: string; updated_at: string }>;
        has_open_mark: boolean;
        has_open_retention: boolean;
        cancelled_seen_at: Date | null;
    }>(
        `WITH latest_decision AS (
             SELECT DISTINCT ON (entity_id) entity_id, reason, occurred_at
             FROM domain_event
             WHERE entity_type = 'subscription'
               AND event_type = 'subscription.provider_cancellation_decided'
             ORDER BY entity_id, occurred_at DESC, id DESC
         ), clock AS (
             SELECT NOW() AS now,
                    (SELECT ("values"->'16'->>'days')::integer
                     FROM billing_deadline_version ORDER BY version DESC LIMIT 1) AS window_days
         ), inventory AS (
             SELECT s.id, s.user_id, s.status, s.class, s.created_at,
                    pl.provider_id, pl.cancelled_seen_at, bo.cycle,
                    decision.reason AS decision_reason,
                    decision.occurred_at AS decision_occurred_at,
                    decision.entity_id IS NOT NULL AS has_decision,
                    EXISTS (SELECT 1 FROM reconciliation_mark rm
                            WHERE rm.subscription_id = s.id AND rm.lifted_at IS NULL) AS has_open_mark,
                    EXISTS (SELECT 1 FROM reconciliation_mark rm
                            WHERE rm.subscription_id = s.id
                              AND rm.reason = 'CANCELACION_SIN_CONFIRMAR'
                              AND rm.lifted_at IS NULL) AS has_open_16,
                    EXISTS (SELECT 1 FROM succession_retained_payment srp
                            WHERE srp.subscription_id = s.id AND srp.released_at IS NULL) AS has_open_retention
             FROM subscription s
             JOIN provider_link pl ON pl.subscription_id = s.id
             LEFT JOIN billing_option bo ON bo.id = s.billing_option_id
             LEFT JOIN latest_decision decision ON decision.entity_id = s.id::text
             WHERE s.status IN ('CANCELLED', 'ABANDONED', 'CHARGE_DECLINED')
         ), candidates AS (
             SELECT 'cancellationRetry' AS pass, i.*
             FROM inventory i
             WHERE i.has_decision AND i.cancelled_seen_at IS NULL AND NOT i.has_open_16
             UNION ALL
             SELECT 'terminalReturn' AS pass, i.*
             FROM inventory i CROSS JOIN clock
             WHERE NOT (i.has_decision AND i.cancelled_seen_at IS NULL AND NOT i.has_open_16)
               AND (i.has_open_mark OR i.has_open_retention
                    OR (i.cancelled_seen_at IS NOT NULL AND i.cancelled_seen_at >
                        clock.now - GREATEST(
                            CASE i.cycle
                                WHEN 'monthly' THEN 31
                                WHEN 'quarterly' THEN 92
                                WHEN 'semiannual' THEN 184
                                WHEN 'annual' THEN 366
                                ELSE 366
                            END, clock.window_days
                        ) * INTERVAL '1 day'))
         )
         SELECT c.pass, c.id AS subscription_id, c.user_id, u.email,
                c.status, c.class, c.created_at, c.provider_id,
                c.decision_reason, c.decision_occurred_at,
                COALESCE(notice.notices, '[]'::jsonb) AS notices,
                c.has_open_mark, c.has_open_retention, c.cancelled_seen_at
         FROM candidates c
         LEFT JOIN users u ON u.id = c.user_id
         LEFT JOIN LATERAL (
             SELECT jsonb_agg(jsonb_build_object(
                        'template', eo.template, 'status', eo.status,
                        'updated_at', eo.updated_at) ORDER BY eo.updated_at DESC) AS notices
             FROM email_outbox eo
             WHERE eo.recipient_user_id = c.user_id
               AND eo.payload->>'subscriptionId' = c.id::text
         ) notice ON true
         WHERE NOT COALESCE(c.user_id = ANY($1::uuid[]), false)
           AND ($2::uuid[] IS NULL OR c.user_id = ANY($2::uuid[]))
         ORDER BY c.pass, c.id`,
        [args.excludeUserIds ?? [], args.includeUserIds ?? null]
    );
    const now = Date.now();
    return rows.map((row) => {
        const reason = row.decision_reason;
        const kind =
            reason && Object.hasOwn(BEFORE_CANCEL_KIND_BY_TRANSITION, reason)
                ? BEFORE_CANCEL_KIND_BY_TRANSITION[
                      reason as keyof typeof BEFORE_CANCEL_KIND_BY_TRANSITION
                  ]
                : null;
        const template =
            kind && kind !== 'RECIPIENTLESS' && kind !== 'UNDECLARED'
                ? BEFORE_CANCEL_TEMPLATE_BY_KIND[kind]
                : null;
        const notice = row.notices.find((candidate) => candidate.template === template) ?? null;
        return {
            ...row,
            expected_notice_template: template,
            notice_status: notice?.status ?? null,
            notice_settled_recently:
                notice !== null &&
                (notice.status === 'sent' || notice.status === 'failed') &&
                now - new Date(notice.updated_at).getTime() <= 30 * 60 * 1000 &&
                row.decision_occurred_at !== null &&
                now - row.decision_occurred_at.getTime() < 3 * 24 * 60 * 60 * 1000
        };
    });
}
