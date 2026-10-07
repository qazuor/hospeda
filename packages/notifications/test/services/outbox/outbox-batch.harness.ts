/**
 * Shared fakes for the outbox sender batch tests (HOS-1423). The batch runs
 * for real; only its storage, provider and hooks are fakes. The SQL behind
 * each dependency is proved against a real database in
 * `packages/db/test/integration/email-outbox-delivery.integration.test.ts`.
 */
import type { EmailOutboxRow, EmailOutboxStatus, RecordEmailAttemptInput } from '@repo/db';
import { createElement } from 'react';
import { vi } from 'vitest';
import {
    type EmailOutboxDeliveryDeps,
    type OutboxEscalation,
    type OutboxLeaseLost,
    type OutboxRowError,
    processEmailOutboxBatch
} from '../../../src/services/outbox/email-outbox-delivery.service';
import { NotificationType } from '../../../src/types/notification.types';

export const NOW = new Date('2026-10-07T12:00:00.000Z');
export const OWNER = 'email-outbox-sender:test';
export const COMMERCIAL = NotificationType.TRIAL_WIN_BACK_5D;
export const TRANSACTIONAL = 'subscription-cancel-notice';

export function row(overrides: Partial<EmailOutboxRow> = {}): EmailOutboxRow {
    return {
        id: crypto.randomUUID(),
        recipientUserId: crypto.randomUUID(),
        recipientEmail: 'host@example.com',
        template: TRANSACTIONAL,
        channel: 'email',
        payload: {},
        status: 'processing',
        dedupKey: crypto.randomUUID(),
        lockedBy: OWNER,
        lockedUntil: new Date(NOW.getTime() + 300_000),
        attempts: 0,
        providerMessageId: null,
        lastError: null,
        correlationId: null,
        createdAt: new Date(NOW.getTime() - 60_000),
        updatedAt: new Date(NOW.getTime() - 60_000),
        ...overrides
    };
}

export interface Harness {
    readonly deps: EmailOutboxDeliveryDeps;
    readonly records: RecordEmailAttemptInput[];
    readonly escalations: OutboxEscalation[];
    readonly rowErrors: OutboxRowError[];
    readonly leaseLost: OutboxLeaseLost[];
    readonly send: ReturnType<typeof vi.fn>;
    readonly outbox: {
        readonly recoverExpired: ReturnType<typeof vi.fn>;
        readonly claim: ReturnType<typeof vi.fn>;
        readonly markSent: ReturnType<typeof vi.fn>;
        readonly recordFailure: ReturnType<typeof vi.fn>;
        readonly markFailed: ReturnType<typeof vi.fn>;
        readonly getRecipientDeletedAt: ReturnType<typeof vi.fn>;
    };
    readonly log: {
        readonly hasHardBounce: ReturnType<typeof vi.fn>;
        readonly countSentByClassSince: ReturnType<typeof vi.fn>;
    };
    readonly isOptedOut: ReturnType<typeof vi.fn>;
}

export function harness(claimed: EmailOutboxRow[]): Harness {
    const records: RecordEmailAttemptInput[] = [];
    const escalations: OutboxEscalation[] = [];
    const rowErrors: OutboxRowError[] = [];
    const leaseLost: OutboxLeaseLost[] = [];
    const outbox = {
        recoverExpired: vi.fn(async () => []),
        claim: vi.fn(async () => claimed),
        markSent: vi.fn(async () => true),
        recordFailure: vi.fn(
            async (input: { id: string; maxAttempts: number }): Promise<EmailOutboxStatus> => {
                const current = claimed.find((r) => r.id === input.id);
                return (current?.attempts ?? 0) + 1 >= input.maxAttempts ? 'failed' : 'retry';
            }
        ),
        markFailed: vi.fn(async () => true),
        getRecipientDeletedAt: vi.fn(async () => null)
    };
    const log = {
        hasHardBounce: vi.fn(async () => false),
        countSentByClassSince: vi.fn(async () => 0)
    };
    const isOptedOut = vi.fn(async () => false);
    const send = vi.fn(async () => ({ messageId: 'msg-1' }));
    const deps: EmailOutboxDeliveryDeps = {
        outbox,
        log: {
            ...log,
            recordEmailAttempt: vi.fn(async (input: RecordEmailAttemptInput) => {
                records.push(input);
                return {} as never;
            })
        },
        isOptedOut,
        render: async ({ row: r }) => ({
            subject: `Subject of ${r.template}`,
            react: createElement('p', null, 'body')
        }),
        transport: { send },
        escalate: async (event) => {
            escalations.push(event);
        },
        onRowError: (event) => {
            rowErrors.push(event);
        },
        onLeaseLost: (event) => {
            leaseLost.push(event);
        }
    };
    return { deps, records, escalations, rowErrors, leaseLost, send, outbox, log, isOptedOut };
}

export async function run(h: Harness) {
    return processEmailOutboxBatch({
        deps: h.deps,
        owner: OWNER,
        now: NOW,
        leaseMs: 300_000,
        batchSize: 50
    });
}
