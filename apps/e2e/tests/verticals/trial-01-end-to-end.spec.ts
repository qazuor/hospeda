// AC:V4:17 "late conversion": moved to the B4 exit (HOS-1536). Under the bootstrap billing the trial never converts (contract §8.2) and no listener calls convertTrialOnTitle yet; see HOS-1449.
import { expect, type Page, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import { createAdjustableClock } from '@repo/test-clock';
import {
    createAccommodation,
    createUser,
    markProfileCompleted
} from '../../fixtures/api-helpers.ts';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import {
    type CapturedE2eMail,
    type E2eMailCaptureServer,
    startE2eMailCapture
} from '../../fixtures/mail-capture-server.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const DAY_MS = 86_400_000;
const MAIL_TIMEOUT_MS = 30_000;

interface TrialRow extends Record<string, unknown> {
    readonly status: string;
    readonly started_at: Date | string;
    readonly ends_at: Date | string;
}

interface OutboxRow extends Record<string, unknown> {
    readonly id: string;
    readonly template: string;
    readonly status: string;
    readonly send_after: Date | string | null;
    readonly last_error: string | null;
}

interface MailExpectation {
    readonly subject: string;
    readonly title: string;
    readonly showsEndDate: boolean;
}

const MAIL_EXPECTATIONS: Readonly<Record<string, MailExpectation>> = {
    trial_ending_10d: {
        subject: '¿Cómo venís con tu publicación?',
        title: '¿Cómo venís con tu publicación?',
        showsEndDate: true
    },
    trial_ending_5d: {
        subject: 'Quedan 5 días de tu prueba gratis',
        title: 'Te quedan 5 días de prueba',
        showsEndDate: true
    },
    trial_ending_2d: {
        subject: 'Quedan 2 días de tu prueba gratis',
        title: 'Te quedan 2 días de prueba',
        showsEndDate: true
    },
    trial_ending_today: {
        subject: 'Hoy termina tu prueba gratis',
        title: 'Hoy termina tu prueba gratis',
        showsEndDate: true
    },
    trial_win_back_1d: {
        subject: 'Tu publicación te está esperando',
        title: 'Tu publicación te está esperando',
        showsEndDate: false
    },
    trial_win_back_5d: {
        subject: 'Volvé a aparecer en Hospeda',
        title: 'Volvé a aparecer en Hospeda',
        showsEndDate: false
    },
    trial_win_back_15d: {
        subject: 'Tu publicación puede volver cuando quieras',
        title: 'Tu publicación puede volver cuando quieras',
        showsEndDate: true
    },
    trial_win_back_30d: {
        subject: '¿Retomamos tu publicación?',
        title: '¿Retomamos tu publicación?',
        showsEndDate: false
    },
    trial_win_back_60d: {
        subject: 'Tu ficha sigue disponible cuando quieras',
        title: 'Tu ficha sigue disponible cuando quieras',
        showsEndDate: false
    }
};

let t0 = new Date();
let fakeServer: Awaited<ReturnType<typeof startE2eFakeProvider>> | null = null;
let capture: E2eMailCaptureServer | null = null;
let owner: Awaited<ReturnType<typeof createUser>> | null = null;
let admin: Awaited<ReturnType<typeof createUser>> | null = null;
let accommodationId = '';
let trialEnd = new Date();
let trialDays = 0;

test.describe('TEST:V4:23 AC:V4:17 the trial end to end @p0 @verticals @clock', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async () => {
        t0 = new Date();
        t0.setSeconds(0, 0);
        const clock = createAdjustableClock({ start: t0 });
        fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() }),
            clock
        });
        capture = await startE2eMailCapture();
        owner = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        await markProfileCompleted({ userId: owner.id });
        admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
        const accommodation = await createAccommodation({
            ownerId: owner.id,
            slugPrefix: 'trial-e2e',
            withTrial: false
        });
        accommodationId = accommodation.id;
        const preTrial = await execSQL<{ count: string }>(
            `SELECT count(*)::text AS count FROM trial
              WHERE user_id = $1 AND vertical = 'accommodation'`,
            [owner.id]
        );
        expect(
            preTrial[0]?.count,
            'the listing owner must start in PRE_TRIAL without a trial row'
        ).toBe('0');
    });

    test.afterAll(async () => {
        try {
            if (owner) {
                await execSQL(
                    `UPDATE email_outbox
                        SET status = 'failed', last_error = 'cancelled:e2e-cleanup',
                            locked_by = NULL, locked_until = NULL
                      WHERE recipient_user_id = $1 AND status IN ('pending', 'retry')`,
                    [owner.id]
                );
            }
            const ids = [owner?.id, admin?.id].filter((id): id is string => Boolean(id));
            if (ids.length > 0) await cleanupTestUsers(getDbPool(), ids);
        } finally {
            try {
                await capture?.close();
            } finally {
                await fakeServer?.close();
            }
        }
    });

    test('activates the trial, sends both campaigns, and ends recovery', async ({ page }) => {
        test.setTimeout(300_000);
        if (!owner || !admin || !fakeServer || !capture) {
            throw new Error('TEST:V4:23 setup did not create its users, clock, and capture server');
        }
        const ownerUser = owner;
        const adminUser = admin;
        const providerServer = fakeServer;
        const mailCapture = capture;

        await test.step('activation through the web starts the clock and queues the pre-expiry campaign', async () => {
            await seedCookieConsent(page);
            await attachSession(page, ownerUser.sessionCookie);
            await page.goto(`${WEB_URL}/es/mi-cuenta/propiedades/`);
            await page.getByRole('button', { name: 'Publicar', exact: true }).click();
            await page.getByRole('button', { name: 'Sí, publicar', exact: true }).click();

            let activeTrial: TrialRow | undefined;
            await expect
                .poll(
                    async () => {
                        const rows = await execSQL<TrialRow>(
                            `SELECT status, started_at, ends_at FROM trial
                              WHERE user_id = $1 AND vertical = 'accommodation'`,
                            [ownerUser.id]
                        );
                        activeTrial = rows[0];
                        return activeTrial?.status;
                    },
                    { timeout: 30_000, message: 'publishing should activate the owner trial' }
                )
                .toBe('TRIAL_ACTIVE');
            expect(activeTrial).toBeDefined();
            const startedAt = new Date(activeTrial?.started_at ?? 0);
            trialEnd = new Date(activeTrial?.ends_at ?? 0);
            expect(Math.abs(startedAt.getTime() - t0.getTime())).toBeLessThan(1000);

            const planRows = await execSQL<{ trial_days: number }>(
                `SELECT v.trial_days
                   FROM plan_version v
                   JOIN plan p ON p.id = v.plan_id
                  WHERE p.vertical = 'accommodation' AND p.role = 'trial' AND v.current = true
                  LIMIT 1`
            );
            trialDays = planRows[0]?.trial_days ?? 0;
            expect(trialDays).toBeGreaterThan(0);
            expect(trialEnd.getTime() - startedAt.getTime()).toBe(trialDays * DAY_MS);

            await expect
                .poll(async () => {
                    const rows = await execSQL<{ publication_status: string }>(
                        'SELECT publication_status FROM accommodations WHERE id = $1',
                        [accommodationId]
                    );
                    return rows[0]?.publication_status;
                })
                .toBe('PUBLISHED');

            const previousRows = (await ownerOutboxRows(ownerUser.id)).filter((row) =>
                row.template.startsWith('trial_ending_')
            );
            const expectedTemplates = expectedPreExpiryTemplates({ startedAt, trialEnd });
            expect(previousRows.map((row) => row.template).sort()).toEqual(
                [...expectedTemplates].sort()
            );
            expect(
                previousRows.every((row) => row.status === 'pending' && row.send_after !== null)
            ).toBe(true);
        });

        await test.step('sends each due pre-expiry message one at a time', async () => {
            const rows = await ownerOutboxRows(ownerUser.id);
            const previous = rows
                .filter((row) => row.template.startsWith('trial_ending_'))
                .sort((a, b) => dateValue(a.send_after) - dateValue(b.send_after));
            for (const row of previous) {
                await sendAtOutboxMilestone({
                    row,
                    ownerEmail: ownerUser.email,
                    admin: adminUser,
                    fakeServer: providerServer,
                    capture: mailCapture
                });
            }
            await expect
                .poll(async () =>
                    (await ownerOutboxRows(ownerUser.id))
                        .filter((row) => previousIds(previous).includes(row.id))
                        .map((row) => row.status)
                )
                .toEqual(previous.map(() => 'sent'));
        });

        await test.step('expires the trial and queues all recovery milestones', async () => {
            await providerServer.setClock({ at: new Date(trialEnd.getTime() + 60_000) });
            await triggerCron({ jobName: 'trial-machine-expiry', admin: adminUser });
            await expect
                .poll(async () => {
                    const rows = await execSQL<{ status: string }>(
                        `SELECT status FROM trial WHERE user_id = $1 AND vertical = 'accommodation'`,
                        [ownerUser.id]
                    );
                    return rows[0]?.status;
                })
                .toBe('TRIAL_EXPIRED');
            await expect
                .poll(
                    async () => {
                        const rows = await execSQL<{ publication_status: string }>(
                            'SELECT publication_status FROM accommodations WHERE id = $1',
                            [accommodationId]
                        );
                        return rows[0]?.publication_status;
                    },
                    { message: 'PB2 should unpublish the listing after the trial coverage expires' }
                )
                .not.toBe('PUBLISHED');
            const recoveries = (await ownerOutboxRows(ownerUser.id)).filter((row) =>
                row.template.startsWith('trial_win_back_')
            );
            expect(recoveries).toHaveLength(5);
            expect(
                recoveries.every((row) => row.status === 'pending' && row.send_after !== null)
            ).toBe(true);
        });

        await test.step('sends each recovery message one at a time', async () => {
            const recoveries = (await ownerOutboxRows(ownerUser.id))
                .filter((row) => row.template.startsWith('trial_win_back_'))
                .sort((a, b) => dateValue(a.send_after) - dateValue(b.send_after));
            for (const row of recoveries) {
                await sendAtOutboxMilestone({
                    row,
                    ownerEmail: ownerUser.email,
                    admin: adminUser,
                    fakeServer: providerServer,
                    capture: mailCapture
                });
            }
            await expect
                .poll(async () =>
                    (await ownerOutboxRows(ownerUser.id))
                        .filter((row) => previousIds(recoveries).includes(row.id))
                        .map((row) => row.status)
                )
                .toEqual(recoveries.map(() => 'sent'));
        });

        await test.step('ends the recovery campaign without another message', async () => {
            const sentMailCount = mailCapture.mailsTo({ to: ownerUser.email }).length;
            const recoveryRows = (await ownerOutboxRows(ownerUser.id)).filter((row) =>
                row.template.startsWith('trial_win_back_')
            );
            const finalSendAfter = Math.max(
                ...recoveryRows.map((row) => dateValue(row.send_after))
            );
            await providerServer.setClock({ at: new Date(finalSendAfter + 30 * DAY_MS) });
            await triggerCron({ jobName: 'email-outbox-sender', admin: adminUser });
            expect(mailCapture.mailsTo({ to: ownerUser.email })).toHaveLength(sentMailCount);
            const remaining = await execSQL<{ id: string }>(
                `SELECT id FROM email_outbox
                  WHERE recipient_user_id = $1 AND status IN ('pending', 'retry')`,
                [ownerUser.id]
            );
            expect(remaining).toHaveLength(0);
            const trial = await execSQL<{ status: string }>(
                `SELECT status FROM trial WHERE user_id = $1 AND vertical = 'accommodation'`,
                [ownerUser.id]
            );
            expect(trial[0]?.status).toBe('TRIAL_EXPIRED');
        });
    });
});

async function attachSession(page: Page, sessionCookie: string): Promise<void> {
    const cookies = sessionCookie.split('; ').flatMap((cookie) => {
        const [name, ...valueParts] = cookie.split('=');
        return name ? [{ name, value: valueParts.join('='), domain: 'localhost', path: '/' }] : [];
    });
    await page.context().addCookies(cookies);
}

async function triggerCron(args: {
    readonly jobName: string;
    readonly admin: Awaited<ReturnType<typeof createUser>>;
}): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/admin/cron/${args.jobName}`, {
        method: 'POST',
        headers: { cookie: args.admin.sessionCookie }
    });
    if (response.status === 401 || response.status === 403) {
        throw new Error(
            `TEST:V4:23 cron ${args.jobName} requires SUPER_ADMIN with SYSTEM_MAINTENANCE_MODE; ` +
                `received HTTP ${response.status}`
        );
    }
    const body = (await response.json()) as {
        success?: boolean;
        processed?: number;
        errors?: number;
        jobName?: string;
        dryRun?: boolean;
        executedAt?: string;
    };
    expect(response.status, `cron ${args.jobName} should return HTTP 200`).toBe(200);
    expect(body, `cron ${args.jobName} should return success:true`).toMatchObject({
        success: true,
        jobName: args.jobName
    });
}

async function ownerOutboxRows(ownerId: string): Promise<OutboxRow[]> {
    return execSQL<OutboxRow>(
        `SELECT id, template, status, send_after, last_error
           FROM email_outbox WHERE recipient_user_id = $1 AND left(template, 6) = 'trial_'
          ORDER BY send_after NULLS FIRST, id`,
        [ownerId]
    );
}

function expectedPreExpiryTemplates(args: {
    readonly startedAt: Date;
    readonly trialEnd: Date;
}): string[] {
    const offsets = [10, 5, 2, 0] as const;
    const today = marketDay(args.startedAt);
    return offsets
        .filter((offset) => marketDay(new Date(args.trialEnd.getTime() - offset * DAY_MS)) >= today)
        .map((offset) => `trial_ending_${offset === 0 ? 'today' : `${offset}d`}`);
}

async function sendAtOutboxMilestone(args: {
    readonly row: OutboxRow;
    readonly ownerEmail: string;
    readonly admin: Awaited<ReturnType<typeof createUser>>;
    readonly fakeServer: NonNullable<typeof fakeServer>;
    readonly capture: E2eMailCaptureServer;
}): Promise<void> {
    const sendAfter = dateValue(args.row.send_after);
    await args.fakeServer.setClock({ at: new Date(sendAfter + 60_000) });
    await triggerCron({ jobName: 'email-outbox-sender', admin: args.admin });
    const expected = MAIL_EXPECTATIONS[args.row.template];
    if (!expected)
        throw new Error(`TEST:V4:23 has no content expectations for ${args.row.template}`);
    const mail = await args.capture.waitForMail({
        to: args.ownerEmail,
        subject: expected.subject,
        timeoutMs: MAIL_TIMEOUT_MS
    });
    expectMailContent({ mail, expected, endDate: trialEnd });
    await expect
        .poll(async () => {
            const rows = await execSQL<{ status: string }>(
                'SELECT status FROM email_outbox WHERE id = $1',
                [args.row.id]
            );
            return rows[0]?.status;
        })
        .toBe('sent');
}

function expectMailContent(args: {
    readonly mail: CapturedE2eMail;
    readonly expected: MailExpectation;
    readonly endDate: Date;
}): void {
    expect(args.mail.to).toContain(owner?.email);
    const html = decodeHtmlEntities(args.mail.html);
    expect(html).toContain(args.expected.title);
    expect(html).toContain('/es/planes/anfitriones/precios/');
    if (args.expected.showsEndDate) expect(html).toContain(formatEndDate(args.endDate));
}

function decodeHtmlEntities(value: string): string {
    // `&amp;` goes last so an escaped entity such as `&amp;lt;` is not decoded twice.
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

function formatEndDate(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires'
    }).formatToParts(value);
    const date = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
    return new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(new Date(`${date}T00:00:00.000Z`));
}

function marketDay(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires'
    }).formatToParts(value);
    return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
}

function dateValue(value: Date | string | null): number {
    if (!value) throw new Error('TEST:V4:23 expected a scheduled send_after date');
    return new Date(value).getTime();
}

function previousIds(rows: readonly OutboxRow[]): string[] {
    return rows.map((row) => row.id);
}
