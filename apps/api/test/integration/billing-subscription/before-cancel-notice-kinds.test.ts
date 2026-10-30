import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutbox,
    eq,
    getDb,
    inArray,
    users
} from '@repo/db';
import {
    type ArrearsSuspensionNoticeContent,
    BEFORE_CANCEL_TEMPLATE_BY_KIND,
    type BeforeCancelNoticeKind
} from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { beforeCancelNotice } from '../../../src/routes/billing-subscription/before-cancel-notice';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const seededUserIds: string[] = [];

async function seedUser() {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `hos1683-kind-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-1683 before-cancel kind user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    seededUserIds.push(user.id);
    return user;
}

/** A valid arrears content; only `ARREARS_SUSPENSION` carries one (AC:B7:30). */
const ARREARS_CONTENT: ArrearsSuspensionNoticeContent = {
    vertical: 'accommodation',
    paymentMethod: 'CARD',
    touristVipLost: false,
    oneTimeAddons: [],
    promoLost: false
};

const KINDS = Object.entries(BEFORE_CANCEL_TEMPLATE_BY_KIND) as ReadonlyArray<
    readonly [BeforeCancelNoticeKind, string]
>;

describe('TEST:1683:3 AC:1683:2 the production notice enqueues each kind with its own template', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });
    afterEach(async () => {
        const ids = seededUserIds.splice(0);
        if (ids.length === 0) return;
        await getDb().delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, ids));
        await getDb().delete(users).where(inArray(users.id, ids));
    });
    afterAll(async () => testDb.teardown());

    it.each(KINDS)('%s enqueues one %s row, keyed by that template', async (kind, template) => {
        // Arrange
        const user = await seedUser();
        const subscriptionId = crypto.randomUUID();
        const input = {
            subscriptionId,
            userId: user.id,
            kind,
            ...(kind === 'ARREARS_SUSPENSION' ? { content: ARREARS_CONTENT } : {})
        };

        // Act
        const first = await beforeCancelNotice.beforeCancel(input);
        const second = await beforeCancelNotice.beforeCancel(input);

        // Assert
        expect(first).toBe('NOT_YET_SENT');
        expect(second).toBe('NOT_YET_SENT');
        const rows = await getDb()
            .select({ template: emailOutbox.template, dedupKey: emailOutbox.dedupKey })
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, user.id));
        expect(rows).toStrictEqual([
            {
                template,
                dedupKey: buildEmailDedupKey({
                    recipient: user.id,
                    template,
                    occurrence: buildEventOccurrence({ eventId: subscriptionId })
                })
            }
        ]);
    });
});
