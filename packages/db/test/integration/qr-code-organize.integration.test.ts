/**
 * Integration test: the HOS-2679 QR organisation SQL against a real Postgres.
 *
 * The unit tests pin the rendered SQL text; only a real database says whether
 * that text MEANS what the docblocks claim. Every assertion here is about rows:
 * which codes the campaign filter returns, which tags a read sees, whether the
 * live-slug index frees a slug on delete, and what the tag-set write leaves
 * behind — including when two writes race and when one fails half-way.
 *
 * Runs under `vitest.config.integration.ts` (migrations applied for real by the
 * global setup, so migration 0259 is exercised too). Uses `withCleanSlate`.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import {
    buildQrCodeTagFilterCondition,
    buildQrCodeUtmCampaignCondition
} from '../../src/models/qr-code/qrCode.filters.ts';
import { QrCodeModel } from '../../src/models/qr-code/qrCode.model.ts';
import { QrCodeTagModel, RQrCodeQrCodeTagModel } from '../../src/models/qr-code/qrCodeTag.model.ts';
import { qrCodes } from '../../src/schemas/qr-code/qr_code.dbschema.ts';
import { qrCodeTags } from '../../src/schemas/qr-code/qr_code_tag.dbschema.ts';
import { rQrCodeQrCodeTag } from '../../src/schemas/qr-code/r_qr_code_qr_code_tag.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, getTestPool, withCleanSlate } from './helpers.ts';

beforeAll(() => {
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

const RENDER = {
    errorCorrectionLevel: 'M',
    format: 'SVG',
    margin: 4,
    size: null,
    foregroundColor: '#000000',
    backgroundColor: '#ffffff',
    centerLogo: 'NONE'
} as const;

let slugCounter = 0;
/** A slug in the QR alphabet, unique per call. */
function nextSlug(): string {
    slugCounter += 1;
    return `Q${'23456789ABCDEFGH'[slugCounter % 16]}${slugCounter.toString(36)}xyz`.replace(
        /[01lo]/gi,
        'z'
    );
}

async function insertCode(
    db: DrizzleClient,
    targetUrl: string,
    over: { deletedAt?: Date } = {}
): Promise<string> {
    const [row] = await db
        .insert(qrCodes)
        .values({
            slug: nextSlug(),
            label: targetUrl.slice(0, 50),
            targetUrl,
            source: 'MANUAL',
            renderOptions: RENDER as never,
            ...over
        })
        .returning({ id: qrCodes.id });
    return row?.id as string;
}

async function insertTag(db: DrizzleClient, name: string, slug: string): Promise<string> {
    const [row] = await db
        .insert(qrCodeTags)
        .values({ name, slug })
        .returning({ id: qrCodeTags.id });
    return row?.id as string;
}

/** Ids of the codes matching `condition`, live only, sorted for comparison. */
async function idsWhere(
    db: DrizzleClient,
    condition: ReturnType<typeof buildQrCodeUtmCampaignCondition>
): Promise<string[]> {
    const rows = await db
        .select({ id: qrCodes.id })
        .from(qrCodes)
        .where(and(isNull(qrCodes.deletedAt), condition));
    return rows.map((row) => row.id).sort();
}

/** The tag ids linked to a code, sorted. */
async function linkedTags(db: DrizzleClient, qrCodeId: string): Promise<string[]> {
    const rows = await db
        .select({ id: rQrCodeQrCodeTag.qrCodeTagId })
        .from(rQrCodeQrCodeTag)
        .where(eq(rQrCodeQrCodeTag.qrCodeId, qrCodeId));
    return rows.map((row) => row.id).sort();
}

describe('utm_campaign extraction and filter (HOS-2679)', () => {
    it('reads the raw first campaign of the query string only', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            await insertCode(db, 'https://h.test/a?utm_campaign=verano%202026');
            await insertCode(db, 'https://h.test/b?x=1&utm_campaign=verano+2026');
            await insertCode(db, 'https://h.test/c?UTM_CAMPAIGN=verano 2026');
            await insertCode(db, 'https://h.test/d?utm%5Fcampaign=lower&utm_campaign=second');
            await insertCode(db, 'https://h.test/e?utm_campaign=first&utm_campaign=second');
            // Never a campaign: a path segment, the fragment, a longer key.
            await insertCode(db, 'https://h.test/utm_campaign=path/');
            await insertCode(db, 'https://h.test/f#utm_campaign=frag');
            await insertCode(db, 'https://h.test/g?utm_campaigns=plural');
            await insertCode(db, 'https://h.test/i?not_utm_campaign=suffix');
            await insertCode(db, 'https://h.test/h?utm_campaign=deleted', {
                deletedAt: new Date()
            });

            // Act
            const raw = await new QrCodeModel().findDistinctRawUtmCampaigns();

            // Assert
            expect(raw.sort()).toStrictEqual(
                ['first', 'lower', 'verano 2026', 'verano%202026', 'verano+2026'].sort()
            );
        });
    });

    it('counts live codes per raw campaign spelling (HOS-2679 PR 2)', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            await insertCode(db, 'https://h.test/a?utm_campaign=verano');
            await insertCode(db, 'https://h.test/b?utm_campaign=verano&x=1');
            await insertCode(db, 'https://h.test/c?utm_campaign=verano+2026');
            await insertCode(db, 'https://h.test/d?ref=none');
            await insertCode(db, 'https://h.test/e?utm_campaign=verano', {
                deletedAt: new Date()
            });

            // Act
            const counts = await new QrCodeModel().countLiveByRawUtmCampaign();

            // Assert
            expect(counts).toStrictEqual([
                { raw: 'verano', count: 2 },
                { raw: 'verano+2026', count: 1 }
            ]);
        });
    });

    it('matches exactly the raw spellings given, %20, + and raw alike', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            const percent = await insertCode(db, 'https://h.test/a?utm_campaign=verano%202026#x');
            const plus = await insertCode(db, 'https://h.test/b?utm_campaign=verano+2026');
            const raw = await insertCode(db, 'https://h.test/c?utm_campaign=verano 2026&y=2');
            const bare = await insertCode(db, 'https://h.test/d?utm_campaign=verano');
            await insertCode(db, 'https://h.test/e?utm_campaign=verano-2025');
            await insertCode(db, 'https://h.test/f?ref=verano');

            // Act
            const spaced = await idsWhere(
                db,
                buildQrCodeUtmCampaignCondition({
                    rawValues: ['verano%202026', 'verano+2026', 'verano 2026']
                })
            );
            const exact = await idsWhere(
                db,
                buildQrCodeUtmCampaignCondition({ rawValues: ['verano'] })
            );
            const none = await idsWhere(db, buildQrCodeUtmCampaignCondition({ rawValues: [] }));

            // Assert
            expect(spaced).toStrictEqual([percent, plus, raw].sort());
            // `verano` never matches `verano-2025` nor a non-UTM `ref=verano`.
            expect(exact).toStrictEqual([bare]);
            expect(none).toStrictEqual([]);
        });
    });
});

describe('tag reads, filter and the live-slug index (HOS-2679)', () => {
    it('drops a soft-deleted tag from reads and filters, and frees its slug', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            const code = await insertCode(db, 'https://h.test/a');
            const live = await insertTag(db, 'Costanera', 'costanera');
            const gone = await insertTag(db, 'Verano', 'verano');
            await new RQrCodeQrCodeTagModel().setTagsForQrCode(code, [live, gone]);
            await db
                .update(qrCodeTags)
                .set({ deletedAt: new Date() })
                .where(eq(qrCodeTags.id, gone));

            // Act
            const refs = await new RQrCodeQrCodeTagModel().findTagRefsByQrCodeIds([code]);
            const byGone = await idsWhere(db, buildQrCodeTagFilterCondition({ tagIds: [gone] }));
            const byEither = await idsWhere(
                db,
                buildQrCodeTagFilterCondition({ tagIds: [gone, live] })
            );
            const tagModel = new QrCodeTagModel();

            // Assert
            expect(refs.get(code)?.map((tag) => tag.id)).toStrictEqual([live]);
            expect(byGone).toStrictEqual([]);
            expect(byEither).toStrictEqual([code]);
            expect(await tagModel.findLiveBySlug('verano')).toBeNull();
            expect(await tagModel.countLiveByIds([live, gone])).toBe(1);
            // The join row survives the soft delete; it just stops being read.
            expect(await linkedTags(db, code)).toStrictEqual([live, gone].sort());

            // The slug is free again.
            const reborn = await insertTag(db, 'Verano', 'verano');
            expect((await tagModel.findLiveBySlug('verano'))?.id).toBe(reborn);
        });
    });

    it('refuses a second LIVE tag with the same slug, by constraint name', async () => {
        await withCleanSlate(async (db) => {
            await insertTag(db, 'Verano', 'verano');

            const error = await insertTag(db, 'VERANO', 'verano').then(
                () => null,
                (caught: unknown) => caught
            );

            // The service maps exactly this code + constraint to 409.
            let cause: unknown = error;
            while (cause && typeof cause === 'object' && !('code' in cause)) {
                cause = (cause as { cause?: unknown }).cause;
            }
            expect((cause as { code?: string }).code).toBe('23505');
            expect((cause as { constraint?: string }).constraint).toBe(
                'qrCodeTags_slug_live_unique'
            );
        });
    });
});

describe('setTagsForQrCode transaction (HOS-2679)', () => {
    it('replaces the whole set, de-duplicates, and clears with []', async () => {
        await withCleanSlate(async (db) => {
            const code = await insertCode(db, 'https://h.test/a');
            const a = await insertTag(db, 'A', 'a');
            const b = await insertTag(db, 'B', 'b');
            const c = await insertTag(db, 'C', 'c');
            const links = new RQrCodeQrCodeTagModel();

            await links.setTagsForQrCode(code, [a, b, a]);
            expect(await linkedTags(db, code)).toStrictEqual([a, b].sort());

            await links.setTagsForQrCode(code, [b, c]);
            expect(await linkedTags(db, code)).toStrictEqual([b, c].sort());

            await links.setTagsForQrCode(code, []);
            expect(await linkedTags(db, code)).toStrictEqual([]);
        });
    });

    it('rolls back entirely when the insert fails, keeping the previous set', async () => {
        await withCleanSlate(async (db) => {
            const code = await insertCode(db, 'https://h.test/a');
            const a = await insertTag(db, 'A', 'a');
            const links = new RQrCodeQrCodeTagModel();
            await links.setTagsForQrCode(code, [a]);

            // A tag id that does not exist violates the FK AFTER the delete ran.
            await expect(
                links.setTagsForQrCode(code, ['99999999-9999-4999-8999-999999999999'])
            ).rejects.toThrow();

            expect(await linkedTags(db, code)).toStrictEqual([a]);
        });
    });

    it('serialises racing writes for one code: the result is one whole set', async () => {
        await withCleanSlate(async (db) => {
            const code = await insertCode(db, 'https://h.test/a');
            const a = await insertTag(db, 'A', 'a');
            const b = await insertTag(db, 'B', 'b');
            const c = await insertTag(db, 'C', 'c');
            const links = new RQrCodeQrCodeTagModel();

            // Twenty concurrent writers of two disjoint sets, none may 500.
            const writes = Array.from({ length: 20 }, (_, i) =>
                links.setTagsForQrCode(code, i % 2 === 0 ? [a, b] : [c])
            );
            await expect(Promise.all(writes)).resolves.toHaveLength(20);

            const final = await linkedTags(db, code);
            expect([[a, b].sort(), [c]]).toContainEqual(final);
        });
    });

    /**
     * The race above rarely overlaps on a fast local DB, so it cannot prove the
     * lock by itself. This does: hold the code row's lock from another session
     * and the write must WAIT for it, then land once it is released. Verified
     * by mutation: without the model's `FOR UPDATE` this test fails.
     */
    it('takes the code row lock before touching the links', async () => {
        await withCleanSlate(async (db) => {
            const code = await insertCode(db, 'https://h.test/a');
            const a = await insertTag(db, 'A', 'a');
            const holder = await getTestPool().connect();
            try {
                await holder.query('BEGIN');
                // NO KEY UPDATE, not UPDATE: the link insert's own FK check takes
                // KEY SHARE on this row, which NO KEY UPDATE does not block — so
                // only the model's explicit FOR UPDATE can make the write wait.
                await holder.query('SELECT id FROM qr_codes WHERE id = $1 FOR NO KEY UPDATE', [
                    code
                ]);

                let settled = false;
                const write = new RQrCodeQrCodeTagModel()
                    .setTagsForQrCode(code, [a])
                    .finally(() => {
                        settled = true;
                    });
                await new Promise((resolve) => setTimeout(resolve, 400));
                expect(settled).toBe(false);

                await holder.query('COMMIT');
                await write;
                expect(await linkedTags(db, code)).toStrictEqual([a]);
            } finally {
                holder.release();
            }
        });
    });
});
