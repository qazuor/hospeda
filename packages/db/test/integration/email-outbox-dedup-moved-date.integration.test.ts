/**
 * TEST:U2:5 (HOS-1425, AC:U2:5) — the moved-target-date half.
 *
 * The occurrence of a schedule notice carries the CURRENT target date of its
 * milestone, so the same notice enqueued twice on the same day leaves one row,
 * and once the date moves (an extension, a renewal, a retention restart) the
 * notice for the new date is a different occurrence and is enqueued. The
 * same-day and parallel halves live in `email-outbox.model.integration.test.ts`.
 *
 * Rows are COMMITTED (the UNIQUE constraint is what is under test), so every
 * row is deleted in `afterEach`.
 */
import { inArray } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { EmailOutboxModel } from '../../src/models/email-outbox/email-outbox.model.ts';
import { buildEmailDedupKey } from '../../src/models/email-outbox/email-outbox-dedup-key.ts';
import { emailOutbox } from '../../src/schemas/email-outbox/email_outbox.dbschema.ts';
import { closeTestPool, getTestDb } from './helpers.ts';

const model = new EmailOutboxModel();
const createdKeys: string[] = [];

/** The dedup key of the trial's "two days before" notice for one target date. */
function trialPreKey(input: { readonly subject: string; readonly targetDate: string }): string {
    const key = buildEmailDedupKey({
        recipient: input.subject,
        template: 'trial-pre',
        occurrence: `trial:${input.subject}:pre:-2d:${input.targetDate}`
    });
    createdKeys.push(key);
    return key;
}

beforeAll(() => {
    setDb(getTestDb());
});

afterEach(async () => {
    if (createdKeys.length > 0) {
        await getTestDb().delete(emailOutbox).where(inArray(emailOutbox.dedupKey, createdKeys));
        createdKeys.length = 0;
    }
});

afterAll(async () => {
    await closeTestPool();
});

describe('TEST:U2:5 (AC:U2:5) a moved target date is a new occurrence', () => {
    it('enqueues one row for two runs on the same day, and a new one once the date moves', async () => {
        // Arrange: the same notice before and after an extension moved the trial end
        const subject = crypto.randomUUID();
        const original = trialPreKey({ subject, targetDate: '2026-10-04' });
        const moved = trialPreKey({ subject, targetDate: '2026-10-11' });
        const notice = { recipientEmail: 'moved@example.com', template: 'trial-pre' } as const;

        // Act: two runs on the same day, then a run after the date moved
        const firstRun = await model.enqueue({ ...notice, dedupKey: original });
        const secondRun = await model.enqueue({ ...notice, dedupKey: original });
        const afterMove = await model.enqueue({ ...notice, dedupKey: moved });

        // Assert
        const rows = await getTestDb()
            .select()
            .from(emailOutbox)
            .where(inArray(emailOutbox.dedupKey, [original, moved]));
        expect(firstRun.enqueued).toBe(true);
        expect(secondRun.enqueued).toBe(false);
        expect(afterMove.enqueued).toBe(true);
        expect(rows.map((r) => r.dedupKey).sort()).toEqual([original, moved].sort());
    });
});
