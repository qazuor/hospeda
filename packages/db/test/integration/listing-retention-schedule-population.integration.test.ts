import type { Accommodation, Experience, Gastronomy } from '@repo/schemas';
import { PublicationStatusEnum as Status } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import { GastronomyModel } from '../../src/models/gastronomy/gastronomy.model.ts';
import type { ListingVertical } from '../../src/models/listing/listing-publication.model.ts';
import { listingRetentionScheduleModel } from '../../src/models/listing/listing-retention-schedule.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());
const now = new Date('2026-10-17T12:00:00.000Z');
const DAY = 86_400_000;
const tables: Readonly<Record<ListingVertical, string>> = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
};
const verticals: readonly ListingVertical[] = ['accommodation', 'gastronomy', 'experience'];

async function makeListing(
    tx: DrizzleClient,
    vertical: ListingVertical,
    ownerId: string,
    destinationId: string,
    status: Status
) {
    const base = {
        name: 'Retention population',
        slug: `retention-pop-${crypto.randomUUID()}`,
        summary: 'Summary',
        description: 'Description',
        ownerId,
        destinationId,
        publicationStatus: status
    };
    if (vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            tx
        );
    if (vertical === 'gastronomy')
        return new GastronomyModel().create(
            { ...base, type: 'RESTAURANT' } as Partial<Gastronomy>,
            tx
        );
    return new ExperienceModel().create({ ...base, type: 'EXCURSION' } as Partial<Experience>, tx);
}

function addCalendarMonths(at: Date, months: number) {
    const result = new Date(at);
    result.setUTCMonth(result.getUTCMonth() + months);
    return result;
}

describe('TEST:V9b:10 AC:V9b:10 retention schedule populations', () => {
    it('includes inclusive notice and purge edges, excludes early and terminal rows, and pages without repeats', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(destination);
            const mine = new Set<string>();
            const starts: { vertical: ListingVertical; id: string; status: Status; at: Date }[] =
                [];
            const purgeEdges: { vertical: ListingVertical; id: string; at: Date }[] = [];
            for (const vertical of verticals) {
                for (const [status, deadlineAt] of [
                    [Status.PUBLISHED, new Date(now.getTime() + 75 * DAY)],
                    [Status.UNPUBLISHED_BY_BILLING, new Date(now.getTime() + 75 * DAY)],
                    [Status.DRAFT, new Date(addCalendarMonths(now, -3).getTime() + 15 * DAY)],
                    [Status.ARCHIVED, new Date(now.getTime() + 165 * DAY)]
                ] as const) {
                    const exact = await makeListing(tx, vertical, user.id, destination.id, status);
                    const early = await makeListing(tx, vertical, user.id, destination.id, status);
                    mine.add(exact.id);
                    mine.add(early.id);
                    const duration =
                        status === Status.DRAFT ? null : status === Status.ARCHIVED ? 180 : 90;
                    const exactStart =
                        duration === null
                            ? deadlineAt
                            : new Date(now.getTime() - (duration - 15) * DAY);
                    const earlyStart = new Date(exactStart.getTime() + 1);
                    starts.push(
                        { vertical, id: exact.id, status, at: exactStart },
                        { vertical, id: early.id, status, at: earlyStart }
                    );
                }
                for (const at of [
                    new Date(now.getTime() - 180 * DAY),
                    new Date(now.getTime() - 180 * DAY + 1)
                ]) {
                    const archived = await makeListing(
                        tx,
                        vertical,
                        user.id,
                        destination.id,
                        Status.ARCHIVED
                    );
                    mine.add(archived.id);
                    purgeEdges.push({ vertical, id: archived.id, at });
                    starts.push({ vertical, id: archived.id, status: Status.ARCHIVED, at });
                }
                for (const status of [Status.MODERATED, Status.PURGED]) {
                    const terminal = await makeListing(
                        tx,
                        vertical,
                        user.id,
                        destination.id,
                        status
                    );
                    mine.add(terminal.id);
                    starts.push({
                        vertical,
                        id: terminal.id,
                        status,
                        at: new Date(now.getTime() - 300 * DAY)
                    });
                }
            }
            for (const row of starts) {
                await tx.execute(sql`UPDATE ${sql.identifier(tables[row.vertical])}
                    SET inactive_since = ${row.at}, deadlines_version = 1 WHERE id = ${row.id}`);
            }
            const collect = async (kind: 'notice' | 'purge') => {
                const ids: string[] = [];
                let after: { vertical: ListingVertical; listingId: string } | null = null;
                do {
                    const page =
                        kind === 'notice'
                            ? await listingRetentionScheduleModel.listRetentionNoticeCandidates({
                                  tx,
                                  now,
                                  after,
                                  limit: 2
                              })
                            : await listingRetentionScheduleModel.listPurgeCandidates({
                                  tx,
                                  now,
                                  after,
                                  limit: 2
                              });
                    ids.push(
                        ...page.items
                            .filter((item) => mine.has(item.listingId))
                            .map((item) => item.listingId)
                    );
                    after = page.next;
                } while (after !== null);
                return ids;
            };
            const noticeIds = await collect('notice');
            const purgeIds = await collect('purge');
            for (const row of starts.filter(
                (item) => item.status !== Status.MODERATED && item.status !== Status.PURGED
            )) {
                const noticeThreshold =
                    row.status === Status.DRAFT
                        ? new Date(addCalendarMonths(now, -3).getTime() + 15 * DAY)
                        : new Date(
                              now.getTime() - (row.status === Status.ARCHIVED ? 165 : 75) * DAY
                          );
                const expected = row.at.getTime() <= noticeThreshold.getTime();
                expect(
                    noticeIds.includes(row.id),
                    `${row.vertical} ${row.status} ${row.id} at ${row.at.toISOString()}`
                ).toBe(expected);
            }
            for (const row of purgeEdges)
                expect(purgeIds.includes(row.id)).toBe(
                    row.at.getTime() <= now.getTime() - 180 * DAY
                );
            for (const row of starts.filter(
                (item) => item.status === Status.MODERATED || item.status === Status.PURGED
            )) {
                expect(noticeIds).not.toContain(row.id);
                expect(purgeIds).not.toContain(row.id);
            }
            expect(new Set(noticeIds).size).toBe(noticeIds.length);
            expect(new Set(purgeIds).size).toBe(purgeIds.length);
        });
    });
});
