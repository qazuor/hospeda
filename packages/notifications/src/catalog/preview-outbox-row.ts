/**
 * Synthetic outbox rows for the email preview.
 *
 * @module catalog/preview-outbox-row
 */

import type { EmailOutboxRow } from '@repo/db';

/** Fixed instant of every preview row, so a preview is deterministic. */
const PREVIEW_INSTANT = new Date('2026-01-15T12:00:00.000Z');

/** Input of {@link buildPreviewOutboxRow}. */
export interface BuildPreviewOutboxRowInput {
    /** Outbox template key. */
    readonly template: string;
    /** Row payload. */
    readonly payload: Record<string, unknown>;
    /** Optional row fields to override. */
    readonly overrides?: Partial<Omit<EmailOutboxRow, 'template' | 'payload'>>;
}

/**
 * Builds an in-memory `email_outbox` row with fictional identifiers. It is
 * never persisted: the preview only hands it to a renderer.
 *
 * @param input - Template, payload and optional overrides.
 * @returns The row.
 */
export function buildPreviewOutboxRow(input: BuildPreviewOutboxRowInput): EmailOutboxRow {
    return {
        id: '00000000-0000-4000-8000-0000000000aa',
        recipientUserId: '00000000-0000-4000-8000-000000000001',
        recipientEmail: 'ana.ejemplo@example.com',
        channel: 'email',
        sendAfter: null,
        status: 'pending',
        dedupKey: `preview:${input.template}`,
        lockedBy: null,
        lockedUntil: null,
        attempts: 0,
        providerMessageId: null,
        lastError: null,
        correlationId: null,
        createdAt: PREVIEW_INSTANT,
        updatedAt: PREVIEW_INSTANT,
        ...input.overrides,
        template: input.template,
        payload: input.payload
    };
}
