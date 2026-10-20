import type { DrizzleClient } from '@repo/db';
import {
    billingDeadlineVersions,
    buildEmailDedupKey,
    buildEventOccurrence,
    desc,
    domainEventModel,
    emailOutboxModel,
    getDb,
    reconciliationSummaryWindowModel
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../../types/index.js';
import { buildReconciliationSummaryPayload } from './build-summary-payload.js';
import {
    defaultSummaryRecipients,
    RECONCILIATION_SUMMARY_EVENT_TYPES,
    RECONCILIATION_SUMMARY_TEMPLATE,
    type SummaryRecipients,
    type SummaryTickOutcome
} from './summary-types.js';

const logger = createLogger('billing-reconciliation-summary');
const PAGE_SIZE = 500;
const FIRST_WINDOW_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** Tick input. Both wall clock and transaction are injectable for repeatable operation. */
export interface RunReconciliationSummaryTickInput {
    readonly now: Date;
    readonly correlationId: string;
}
/** Optional clock-independent ports used by tests and callers. */
export interface RunReconciliationSummaryTickPorts {
    readonly tx?: DrizzleClient;
    readonly recipients?: SummaryRecipients;
    readonly deadlines?: {
        getCurrent(input?: {
            readonly tx?: DrizzleClient;
        }): Promise<{ version: number; values: unknown }>;
    };
}

async function currentDeadlines(tx: DrizzleClient) {
    const [row] = await (tx ?? getDb())
        .select()
        .from(billingDeadlineVersions)
        .orderBy(desc(billingDeadlineVersions.version))
        .limit(1);
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Billing deadline version is missing',
            undefined,
            'BILLING_DEADLINE_19_MISSING'
        );
    return row;
}
async function eventsBetween(after: Date, until: Date, tx: DrizzleClient) {
    const result = [];
    let afterEventId: string | undefined;
    while (true) {
        const page = await domainEventModel.listByTypesInRange({
            eventTypes: RECONCILIATION_SUMMARY_EVENT_TYPES,
            after,
            until,
            afterEventId,
            limit: PAGE_SIZE,
            tx
        });
        result.push(...page);
        if (page.length < PAGE_SIZE) return result;
        afterEventId = page[page.length - 1]?.id;
    }
}

/** Opens, waits for, then sends a single aggregated mail per SUPER_ADMIN. */
export async function runReconciliationSummaryTick(
    input: RunReconciliationSummaryTickInput,
    ports: RunReconciliationSummaryTickPorts = {}
): Promise<SummaryTickOutcome> {
    if (ports.tx) return runTickInTransaction(input, ports.tx, ports);
    return getDb().transaction((tx) => runTickInTransaction(input, tx, ports));
}

async function runTickInTransaction(
    input: RunReconciliationSummaryTickInput,
    tx: DrizzleClient,
    ports: RunReconciliationSummaryTickPorts
): Promise<SummaryTickOutcome> {
    const open = await reconciliationSummaryWindowModel.findOpen({ tx });
    if (!open) {
        const latest = await reconciliationSummaryWindowModel.findLatest({ tx });
        const coversFrom =
            latest?.closesAt ?? new Date(input.now.getTime() - FIRST_WINDOW_LOOKBACK_MS);
        const eventCount = await domainEventModel.countByTypesInRange({
            eventTypes: RECONCILIATION_SUMMARY_EVENT_TYPES,
            after: coversFrom,
            until: input.now,
            tx
        });
        if (eventCount === 0) return 'IDLE';
        const deadlines = await (ports.deadlines?.getCurrent({ tx }) ?? currentDeadlines(tx));
        const values = deadlines.values as { '19'?: { minutes?: unknown } };
        const minutes = values?.['19']?.minutes;
        if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes <= 0) {
            throw new ServiceError(
                ServiceErrorCode.CONFIGURATION_ERROR,
                'Billing deadline 19 is missing or invalid',
                undefined,
                'BILLING_DEADLINE_19_MISSING'
            );
        }
        const opened = await reconciliationSummaryWindowModel.open({
            coversFrom,
            openedAt: input.now,
            closesAt: new Date(input.now.getTime() + minutes * 60_000),
            windowMinutes: minutes,
            deadlinesVersion: deadlines.version,
            tx
        });
        return opened ? 'WINDOW_OPENED' : 'WAITING';
    }
    if (input.now < open.closesAt) return 'WAITING';
    const events = await eventsBetween(open.coversFrom, open.closesAt, tx);
    if (events.length === 0) {
        await reconciliationSummaryWindowModel.markSent({
            id: open.id,
            sentAt: input.now,
            eventCount: 0,
            tx
        });
        return 'SENT';
    }
    const recipients = await (ports.recipients ?? defaultSummaryRecipients).list({ tx });
    if (events.length > 0 && recipients.length === 0) {
        logger.warn({ windowId: open.id }, 'No SUPER_ADMIN recipients for reconciliation summary');
        return 'NO_RECIPIENTS';
    }
    const payload = buildReconciliationSummaryPayload({ window: open, events });
    for (const recipient of recipients) {
        const template = RECONCILIATION_SUMMARY_TEMPLATE;
        const dedupKey = buildEmailDedupKey({
            recipient: recipient.userId,
            template,
            occurrence: buildEventOccurrence({ eventId: open.id })
        });
        await emailOutboxModel.enqueue(
            {
                recipientUserId: recipient.userId,
                recipientEmail: recipient.email,
                template,
                payload: { ...payload },
                dedupKey,
                correlationId: input.correlationId
            },
            tx
        );
    }
    await reconciliationSummaryWindowModel.markSent({
        id: open.id,
        sentAt: input.now,
        eventCount: events.length,
        tx
    });
    return 'SENT';
}
