/**
 * ai-questions-weekly-digest cron (HOS-2101).
 *
 * The owner decisions the selection must enforce: no email on an empty week,
 * no email to an owner who opted out, one email per owner per week, es/en/pt,
 * and a link per listing to its «Preguntas a la IA» tab.
 */

import { NotificationType } from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type AiQuestionsDigestDeps,
    aiQuestionsWeeklyDigestJob,
    runAiQuestionsWeeklyDigest
} from '../../src/cron/jobs/ai-questions-weekly-digest.job';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';
import {
    acceptsDigest,
    buildPanelUrl,
    type DigestRow,
    groupDigestRows
} from '../../src/services/ai-questions-digest.helpers';

const NOW = new Date('2026-11-16T12:00:00.000Z');
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_OWNER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LISTING = '11111111-1111-4111-8111-111111111111';
const VENUE = '22222222-2222-4222-8222-222222222222';

function row(overrides: Partial<DigestRow> = {}): DigestRow {
    return {
        ownerId: OWNER,
        entityType: 'accommodation',
        entityId: LISTING,
        listingName: 'Cabaña del Río',
        question: '¿Aceptan mascotas?',
        askedAt: new Date('2026-11-14T10:00:00.000Z'),
        ...overrides
    };
}

function buildDeps(input: {
    readonly rows: readonly DigestRow[];
    readonly settings?: unknown;
    readonly alreadySent?: boolean;
}): AiQuestionsDigestDeps & { readonly send: ReturnType<typeof vi.fn> } {
    return {
        readRows: vi.fn().mockResolvedValue({ rows: input.rows }),
        readRecipients: vi.fn().mockImplementation(async ({ ownerIds }) => ({
            recipients: ownerIds.map((id: string) => ({
                id,
                email: `${id}@example.test`,
                name: 'Ana',
                settings: input.settings ?? null
            }))
        })),
        alreadySent: vi.fn().mockResolvedValue(input.alreadySent ?? false),
        send: vi.fn().mockResolvedValue({ delivered: true }),
        siteUrl: 'https://hospeda.test/'
    };
}

describe('aiQuestionsWeeklyDigestJob — registration', () => {
    it('runs on Mondays and is in the manifest', () => {
        const entry = CRON_SCHEDULES.find((job) => job.name === aiQuestionsWeeklyDigestJob.name);
        expect(entry?.schedule).toBe('0 9 * * 1');
        expect(aiQuestionsWeeklyDigestJob.schedule).toBe('0 9 * * 1');
    });
});

describe('runAiQuestionsWeeklyDigest', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sends no email when the week had no unanswered question', async () => {
        // Arrange
        const deps = buildDeps({ rows: [] });

        // Act
        const output = await runAiQuestionsWeeklyDigest({ now: NOW, deps });

        // Assert
        expect(deps.send).not.toHaveBeenCalled();
        expect(output.owners).toBe(0);
    });

    it('reads exactly the previous 7 days', async () => {
        const deps = buildDeps({ rows: [] });

        await runAiQuestionsWeeklyDigest({ now: NOW, deps });

        expect(deps.readRows).toHaveBeenCalledWith({
            windowStart: new Date('2026-11-09T12:00:00.000Z'),
            windowEnd: NOW
        });
    });

    it('sends no email to an owner who switched the digest off', async () => {
        const deps = buildDeps({ rows: [row()], settings: { aiQuestionsDigest: false } });

        const output = await runAiQuestionsWeeklyDigest({ now: NOW, deps });

        expect(deps.send).not.toHaveBeenCalled();
        expect(output.skippedOptOut).toBe(1);
    });

    it('sends no email to an owner who disabled emails altogether', async () => {
        const deps = buildDeps({
            rows: [row()],
            settings: { notifications: { allowEmails: false } }
        });

        await runAiQuestionsWeeklyDigest({ now: NOW, deps });

        expect(deps.send).not.toHaveBeenCalled();
    });

    it('does not send twice in the same week', async () => {
        const deps = buildDeps({ rows: [row()], alreadySent: true });

        const output = await runAiQuestionsWeeklyDigest({ now: NOW, deps });

        expect(deps.send).not.toHaveBeenCalled();
        expect(output.skippedAlreadySent).toBe(1);
        expect(deps.alreadySent).toHaveBeenCalledWith({
            idempotencyKey: `ai-questions-digest:${OWNER}:2026-11-09`
        });
    });

    it('sends one localised email per owner with a panel link per listing', async () => {
        // Arrange
        const deps = buildDeps({
            rows: [
                row(),
                row({ question: '¿Hay cochera?' }),
                row({
                    entityType: 'venue',
                    entityId: VENUE,
                    listingName: 'Parrilla',
                    question: 'Do you have gluten-free options?'
                })
            ],
            settings: { languageWeb: 'en' }
        });

        // Act
        const output = await runAiQuestionsWeeklyDigest({ now: NOW, deps });

        // Assert
        expect(output.sent).toBe(1);
        const payload = deps.send.mock.calls[0]?.[0];
        expect(payload.type).toBe(NotificationType.AI_QUESTIONS_WEEKLY_DIGEST);
        expect(payload.locale).toBe('en');
        expect(payload.digestSubject).toBe('Your AI chat could not answer 3 questions this week');
        expect(payload.preferencesUrl).toBe('https://hospeda.test/en/mi-cuenta/preferencias/');
        expect(payload.listings).toEqual([
            {
                listingName: 'Cabaña del Río',
                unansweredCount: 2,
                questions: ['¿Aceptan mascotas?', '¿Hay cochera?'],
                panelUrl: `https://hospeda.test/en/mi-cuenta/propiedades/${LISTING}/editar/preguntas-ia/`
            },
            {
                listingName: 'Parrilla',
                unansweredCount: 1,
                questions: ['Do you have gluten-free options?'],
                panelUrl: `https://hospeda.test/en/mi-cuenta/comercio/venue/${VENUE}/editar/preguntas-ia/`
            }
        ]);
    });

    it('counts an undelivered send as a failure', async () => {
        const deps = buildDeps({ rows: [row()] });
        deps.send.mockResolvedValue({ delivered: false });

        const output = await runAiQuestionsWeeklyDigest({ now: NOW, deps });

        expect(output.failed).toBe(1);
        expect(output.sent).toBe(0);
    });
});

describe('selection helpers', () => {
    it('groups by owner and caps the quoted questions at five, newest first', () => {
        const rows = Array.from({ length: 7 }, (_, index) =>
            row({
                question: `q${index}`,
                askedAt: new Date(Date.UTC(2026, 10, 10, index))
            })
        );
        const { digests } = groupDigestRows({
            rows: [...rows, row({ ownerId: OTHER_OWNER })]
        });

        expect(digests).toHaveLength(2);
        const mine = digests.find((digest) => digest.ownerId === OWNER);
        expect(mine?.totalUnanswered).toBe(7);
        expect(mine?.listings[0]?.questions).toEqual(['q6', 'q5', 'q4', 'q3', 'q2']);
    });

    it.each([
        [null, true],
        [{}, true],
        [{ aiQuestionsDigest: true }, true],
        [{ aiQuestionsDigest: false }, false],
        [{ notifications: { allowEmails: false } }, false]
    ])('acceptsDigest(%j) is %s', (settings, expected) => {
        expect(acceptsDigest({ settings }).accepts).toBe(expected);
    });

    it('builds the experience panel link under the shared listing editor', () => {
        expect(
            buildPanelUrl({
                siteUrl: 'https://hospeda.test',
                locale: 'pt',
                entityType: 'experience',
                entityId: VENUE
            }).url
        ).toBe(
            `https://hospeda.test/pt/mi-cuenta/comercio/experience/${VENUE}/editar/preguntas-ia/`
        );
    });
});
