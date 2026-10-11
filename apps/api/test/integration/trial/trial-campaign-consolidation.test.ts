import { randomUUID } from 'node:crypto';
import { type CoverageResponse, CoverageResponseSchema } from '@repo/billing-verticals-contract';
import {
    emailOutbox,
    emailOutboxModel,
    eq,
    getDb,
    inArray,
    notificationLogModel,
    sql,
    trials
} from '@repo/db';
import {
    classifyOutboxTemplate,
    createOutboxMailRenderer,
    createTrialCampaignRenderers,
    NotificationType,
    processEmailOutboxBatch
} from '@repo/notifications';
import { VerticalEnum } from '@repo/schemas';
import { renderToStaticMarkup } from 'react-dom/server';
import { convertTrialOnTitle } from '../../../../../packages/verticals/src/trial/trial-conversion';
import { expireTrial } from '../../../../../packages/verticals/src/trial/trial-expiry';
import type { TrialAfterCommit } from '../../../../../packages/verticals/src/trial/trial-machine-types';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getTrialMachinePorts } from '../../../src/utils/trial/trial-machine-ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createOwner,
    createTrial,
    ensurePublicationCatalog
} from '../listing-publication/publication-routes.helpers';

const start = new Date('2026-10-06T12:00:00.000Z');
const noEffects: TrialAfterCommit = {
    emitCoverageChanged: async () => undefined,
    invalidateUser: async () => undefined
};
function coverage(input: { readonly covered: boolean }): CoverageResponse {
    return CoverageResponseSchema.parse(
        input.covered
            ? {
                  covered: true,
                  sources: [
                      {
                          type: 'SUBSCRIPTION',
                          reference: { kind: 'PLAN_VERSION', planVersionId: randomUUID() },
                          scope: 'VERTICAL',
                          target: null,
                          since: start,
                          until: 'NO_KNOWN_DATE',
                          charged: true,
                          floor: null
                      }
                  ]
              }
            : { covered: false, sources: [] }
    );
}
function clock(now: Date) {
    return { now: () => now };
}
async function rowsFor(userId: string) {
    return getDb().select().from(emailOutbox).where(eq(emailOutbox.recipientUserId, userId));
}

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});
beforeEach(async () => {
    await testDb.clean();
    injectClock({ clock: clock(start) });
});
afterAll(async () => testDb.teardown());

describe('TEST:V4:22 (parte 2: clase y una sola pieza) - three verticals, one piece per milestone, before the daily cap', () => {
    it('consolida antes del tope y retira solo la vertical convertida', async () => {
        await ensurePublicationCatalog(VerticalEnum.ACCOMMODATION);
        await ensurePublicationCatalog(VerticalEnum.GASTRONOMY);
        await ensurePublicationCatalog(VerticalEnum.EXPERIENCE);
        const owner = await createOwner();
        for (const vertical of [
            VerticalEnum.ACCOMMODATION,
            VerticalEnum.GASTRONOMY,
            VerticalEnum.EXPERIENCE
        ] as const) {
            await createTrial({ userId: owner.id, status: 'TRIAL_ACTIVE', vertical });
        }
        const expiredAt = new Date('2026-10-06T00:00:00.000Z');
        await getDb().update(trials).set({ endsAt: expiredAt }).where(eq(trials.userId, owner.id));
        const expiryClock = clock(new Date('2026-10-06T13:00:00.000Z'));
        injectClock({ clock: expiryClock });
        const machine = getTrialMachinePorts();
        for (const vertical of [
            VerticalEnum.ACCOMMODATION,
            VerticalEnum.GASTRONOMY,
            VerticalEnum.EXPERIENCE
        ] as const) {
            await expireTrial({
                ...machine,
                clock: expiryClock,
                afterCommit: noEffects,
                input: { userId: owner.id, vertical }
            });
        }
        const recovery = (await rowsFor(owner.id)).filter((row) =>
            row.template.startsWith('trial_win_back_')
        );
        expect(recovery).toHaveLength(5);
        for (const row of recovery)
            expect(classifyOutboxTemplate({ template: row.template }).emailClass).toBe(
                'commercial'
            );
        for (const template of [
            NotificationType.TRIAL_ENDING_10D,
            NotificationType.TRIAL_ENDING_5D,
            NotificationType.TRIAL_ENDING_2D,
            NotificationType.TRIAL_ENDING_TODAY
        ]) {
            expect(classifyOutboxTemplate({ template }).emailClass).toBe('transactional');
        }

        const sent: string[] = [];
        const claimedRows: Awaited<ReturnType<typeof emailOutboxModel.claim>> = [];
        const markedSentIds: string[] = [];
        const now = new Date('2026-10-07T12:00:00.000Z');
        const db = getDb();
        const scopedClaim = async (input: Parameters<typeof emailOutboxModel.claim>[0]) => {
            const claimAt = input.now ?? now;
            const result = await db.execute(
                sql`UPDATE email_outbox SET status = 'processing', locked_by = ${input.owner}, locked_until = ${new Date(claimAt.getTime() + input.leaseMs).toISOString()}::timestamptz WHERE id IN (SELECT id FROM email_outbox WHERE recipient_user_id = ${owner.id} AND status IN ('pending', 'retry') AND (send_after IS NULL OR send_after <= ${claimAt.toISOString()}::timestamptz) ORDER BY created_at ASC LIMIT ${input.limit} FOR UPDATE SKIP LOCKED) RETURNING id`
            );
            const ids = (result.rows as Array<{ readonly id: string }>).map(({ id }) => id);
            const claimed = ids.length
                ? await db.select().from(emailOutbox).where(inArray(emailOutbox.id, ids))
                : [];
            claimedRows.push(...claimed);
            return claimed;
        };
        const scopedOutbox = {
            recoverExpired: (input: Parameters<typeof emailOutboxModel.recoverExpired>[0]) =>
                emailOutboxModel.recoverExpired(input),
            claim: scopedClaim,
            markSent: async (input: Parameters<typeof emailOutboxModel.markSent>[0]) => {
                const marked = await emailOutboxModel.markSent(input);
                if (marked) markedSentIds.push(input.id);
                return marked;
            },
            recordFailure: (input: Parameters<typeof emailOutboxModel.recordFailure>[0]) =>
                emailOutboxModel.recordFailure(input),
            markFailed: (input: Parameters<typeof emailOutboxModel.markFailed>[0]) =>
                emailOutboxModel.markFailed(input),
            getRecipientDeletedAt: (
                input: Parameters<typeof emailOutboxModel.getRecipientDeletedAt>[0]
            ) => emailOutboxModel.getRecipientDeletedAt(input)
        };
        const stats = await processEmailOutboxBatch({
            deps: {
                outbox: scopedOutbox,
                log: notificationLogModel,
                isOptedOut: async () => false,
                render: createOutboxMailRenderer({
                    renderers: createTrialCampaignRenderers({ siteUrl: 'https://hospeda.test' })
                }),
                transport: {
                    send: async ({ react }) => {
                        sent.push(renderToStaticMarkup(react));
                        return { messageId: randomUUID() };
                    }
                },
                escalate: async () => undefined,
                onRowError: () => undefined,
                onLeaseLost: () => undefined
            },
            owner: 'trial-consolidation-test',
            now,
            leaseMs: 60_000,
            batchSize: 50,
            dailyCap: 1
        });
        expect(stats.sent).toBe(1);
        expect(stats.suppressed).toBe(0);
        const firstClaimed = claimedRows.filter(
            (row) => row.template === NotificationType.TRIAL_WIN_BACK_1D
        );
        expect(firstClaimed).toHaveLength(1);
        expect(markedSentIds).toContain(firstClaimed[0]?.id);
        const sentHtml = sent.join(' ');
        expect(sentHtml).toContain('Alojamiento');
        expect(sentHtml).toContain('Gastronomía');
        expect(sentHtml).toContain('Experiencias');

        await convertTrialOnTitle({
            ...machine,
            billing: { coverage: async () => coverage({ covered: true }) },
            afterCommit: noEffects,
            event: {
                userId: owner.id,
                vertical: VerticalEnum.GASTRONOMY,
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            }
        });
        const secondNow = new Date('2026-10-11T12:00:00.000Z');
        const sentBeforeSecondMilestone = sent.length;
        claimedRows.length = 0;
        markedSentIds.length = 0;
        const secondStats = await processEmailOutboxBatch({
            deps: {
                outbox: scopedOutbox,
                log: notificationLogModel,
                isOptedOut: async () => false,
                render: createOutboxMailRenderer({
                    renderers: createTrialCampaignRenderers({ siteUrl: 'https://hospeda.test' })
                }),
                transport: {
                    send: async ({ react }) => {
                        sent.push(renderToStaticMarkup(react));
                        return { messageId: randomUUID() };
                    }
                },
                escalate: async () => undefined,
                onRowError: () => undefined,
                onLeaseLost: () => undefined
            },
            owner: 'trial-consolidation-test-2',
            now: secondNow,
            leaseMs: 60_000,
            batchSize: 50,
            dailyCap: 1
        });
        expect(secondStats.sent).toBe(1);
        const secondHtml = sent.slice(sentBeforeSecondMilestone).join(' ');
        expect(secondHtml).toContain('Alojamiento');
        expect(secondHtml).toContain('Experiencias');
        expect(secondHtml).not.toContain('Gastronomía');
        const secondClaimed = claimedRows.filter(
            (row) => row.template === NotificationType.TRIAL_WIN_BACK_5D
        );
        expect(secondClaimed).toHaveLength(1);
        expect(secondClaimed[0]?.payload.verticals).toEqual(['accommodation', 'experience']);
        expect(markedSentIds).toContain(secondClaimed[0]?.id);
    });
});
