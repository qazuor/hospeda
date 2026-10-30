/**
 * Helpers of TEST:V4:23's late conversion (AC:V4:17, T5; HOS-1536, Coord-99),
 * split from `tests/verticals/trial-02-late-conversion.spec.ts` to keep the
 * spec short. They read the owner's rows by SQL and assert the content of a
 * captured trial notice the way `trial-01-end-to-end.spec.ts` does (B/19 §4).
 *
 * Listings are read through `publication_status` only (HOS-1641, TEST:V6:18).
 */
import { expect } from '@playwright/test';
import { execSQL } from './db-helpers.ts';
import type { CapturedE2eMail } from './mail-capture-server.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

/** One `trial_*` row of the owner's email outbox. */
export interface TrialOutboxRow extends Record<string, unknown> {
    readonly id: string;
    readonly template: string;
    readonly status: string;
    readonly send_after: Date | string | null;
}

/** The subject and title of a recovery notice (B/19 §4), as `trial-01` asserts them. */
export const WIN_BACK_MAILS: Readonly<
    Record<string, { readonly subject: string; readonly title: string }>
> = {
    trial_win_back_1d: {
        subject: 'Tu publicación te está esperando',
        title: 'Tu publicación te está esperando'
    },
    trial_win_back_5d: {
        subject: 'Volvé a aparecer en Hospeda',
        title: 'Volvé a aparecer en Hospeda'
    },
    trial_win_back_15d: {
        subject: 'Tu publicación puede volver cuando quieras',
        title: 'Tu publicación puede volver cuando quieras'
    },
    trial_win_back_30d: {
        subject: '¿Retomamos tu publicación?',
        title: '¿Retomamos tu publicación?'
    },
    trial_win_back_60d: {
        subject: 'Tu ficha sigue disponible cuando quieras',
        title: 'Tu ficha sigue disponible cuando quieras'
    }
};

/** Every `trial_*` outbox row of the owner, oldest send first. */
export async function trialOutboxRows(args: {
    readonly ownerId: string;
}): Promise<TrialOutboxRow[]> {
    return execSQL<TrialOutboxRow>(
        `SELECT id, template, status, send_after
           FROM email_outbox WHERE recipient_user_id = $1 AND left(template, 6) = 'trial_'
          ORDER BY send_after NULLS FIRST, id`,
        [args.ownerId]
    );
}

/** The owner's accommodation trial status, or `undefined` without a row. */
export async function trialStatus(args: { readonly ownerId: string }): Promise<string | undefined> {
    const rows = await execSQL<{ status: string }>(
        `SELECT status FROM trial WHERE user_id = $1 AND vertical = 'accommodation'`,
        [args.ownerId]
    );
    return rows[0]?.status;
}

/** The listing's `publication_status`. */
export async function publicationStatus(args: {
    readonly accommodationId: string;
}): Promise<string | undefined> {
    const rows = await execSQL<{ publication_status: string }>(
        'SELECT publication_status FROM accommodations WHERE id = $1',
        [args.accommodationId]
    );
    return rows[0]?.publication_status;
}

/** The status of the subscription. */
export async function subscriptionStatus(args: {
    readonly subscriptionId: string;
}): Promise<string | undefined> {
    const rows = await execSQL<{ status: string }>(
        'SELECT status FROM subscription WHERE id = $1',
        [args.subscriptionId]
    );
    return rows[0]?.status;
}

/** Runs one admin cron trigger as `trial-01` does: 201 with `success: true`. */
export async function runCron(args: {
    readonly jobName: string;
    readonly adminCookie: string;
}): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/admin/cron/${args.jobName}`, {
        method: 'POST',
        headers: { cookie: args.adminCookie }
    });
    const body = (await response.json()) as {
        readonly success?: boolean;
        readonly jobName?: string;
        readonly data?: { readonly success?: boolean; readonly jobName?: string };
    };
    expect(response.status, `cron ${args.jobName} should return HTTP 201`).toBe(201);
    expect(body.data ?? body, `cron ${args.jobName} should return success:true`).toMatchObject({
        success: true,
        jobName: args.jobName
    });
}

/** Decodes the HTML entities a rendered notice may carry (`&amp;` last). */
function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
            String.fromCodePoint(Number.parseInt(code, 16))
        )
        .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
        .replace(/&amp;/g, '&');
}

/** Asserts a captured recovery notice: addressed to the owner, its title, the pricing link. */
export function expectWinBackContent(args: {
    readonly mail: CapturedE2eMail;
    readonly ownerEmail: string;
    readonly title: string;
}): void {
    expect(args.mail.to).toContain(args.ownerEmail);
    const html = decodeHtmlEntities(args.mail.html);
    expect(html).toContain(args.title);
    expect(html).toContain('/es/planes/anfitriones/precios/');
}

/** The instant of a scheduled outbox row. */
export function sendAfterOf(row: TrialOutboxRow): number {
    if (!row.send_after) throw new Error('TEST:V4:23 expected a scheduled send_after date');
    return new Date(row.send_after).getTime();
}
