/**
 * Tests for the partner-mention notification port (HOS-377 T-021).
 *
 * What is actually at stake here, in order:
 *
 * 1. **AC-9 is a COUNT, not a boolean.** A four-channel campaign must produce
 *    exactly ONE email. Asserting "a mail went out" passes just as happily on
 *    the four-emails-per-campaign bug this exists to prevent, so every send
 *    assertion below is on `toHaveBeenCalledTimes`.
 * 2. **A partner with no address is an ordinary state (R-2).** `contactInfo` is
 *    nullable and every field inside it is nullish, so a hand-curated partner
 *    legitimately has none. That must log and skip, never throw — the rows are
 *    already committed by the time this runs.
 * 3. **A throwing transport must not surface.** The service swallows it, but
 *    the port must not be the thing that makes the swallow necessary by
 *    throwing something the service was not expecting.
 *
 * @module test/lib/partner-mention-notify-port
 */

import { PartnerMentionChannelEnum, PreferredContactEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendNotificationMock, findByIdMock, warnMock, infoMock } = vi.hoisted(() => ({
    sendNotificationMock: vi.fn(),
    findByIdMock: vi.fn(),
    warnMock: vi.fn(),
    infoMock: vi.fn()
}));

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    class PartnerModelStub {
        findById = findByIdMock;
    }
    return { ...actual, PartnerModel: PartnerModelStub, getDb: vi.fn() };
});

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: sendNotificationMock
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { warn: warnMock, info: infoMock, error: vi.fn(), debug: vi.fn() }
}));

import { createPartnerMentionNotifyPort } from '../../src/lib/partner-ports';

const PARTNER_ID = '00000000-0000-4000-a000-000000000001';
const OWNER_ID = '00000000-0000-4000-a000-0000000000a1';
const BATCH_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AUG_01 = new Date('2026-08-01T15:00:00.000Z');

const makeMention = (channel: PartnerMentionChannelEnum, url: string | null) => ({
    id: `m-${channel}`,
    partnerId: PARTNER_ID,
    batchId: BATCH_ID,
    channel,
    url,
    mentionedAt: AUG_01,
    internalNote: 'never leaves the admin surface'
});

/** A campaign that ran on four networks: ONE thing that happened. */
const FOUR_CHANNEL_BATCH = [
    makeMention(PartnerMentionChannelEnum.INSTAGRAM, 'https://ig.test/1'),
    makeMention(PartnerMentionChannelEnum.FACEBOOK, 'https://fb.test/1'),
    makeMention(PartnerMentionChannelEnum.NEWSLETTER, 'https://hospeda.test/n/8'),
    makeMention(PartnerMentionChannelEnum.WHATSAPP, null)
];

const makePartner = (overrides: Record<string, unknown> = {}) => ({
    id: PARTNER_ID,
    name: 'Acme Turismo',
    ownerUserId: OWNER_ID,
    contactInfo: { workEmail: 'hola@acme.test' },
    ...overrides
});

// biome-ignore lint/suspicious/noExplicitAny: the port takes a structural input; the full row type is irrelevant here
const notify = (mentions: unknown[], batchId: string | null = BATCH_ID) =>
    createPartnerMentionNotifyPort()({
        partnerId: PARTNER_ID,
        batchId,
        mentions: mentions as any
    });

beforeEach(() => {
    vi.clearAllMocks();
    findByIdMock.mockResolvedValue(makePartner());
    sendNotificationMock.mockResolvedValue(undefined);
});

describe('AC-9 — one email per submission, never one per row', () => {
    it('sends EXACTLY ONE email for a four-channel batch', async () => {
        await notify(FOUR_CHANNEL_BATCH);

        // The assertion that matters. "A mail went out" would pass on the
        // four-emails-per-campaign bug this whole test exists to prevent.
        expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    });

    it('puts all four channels inside that single email', async () => {
        await notify(FOUR_CHANNEL_BATCH);

        const payload = sendNotificationMock.mock.calls[0]?.[0];
        expect(payload.mentions).toHaveLength(4);
        expect(payload.mentions.map((m: { channelLabel: string }) => m.channelLabel)).toEqual([
            'Instagram',
            'Facebook',
            'Newsletter',
            'WhatsApp'
        ]);
    });

    it('carries the link for every channel that has one, and null for the one that does not', async () => {
        await notify(FOUR_CHANNEL_BATCH);

        const payload = sendNotificationMock.mock.calls[0]?.[0];
        expect(payload.mentions.map((m: { url: string | null }) => m.url)).toEqual([
            'https://ig.test/1',
            'https://fb.test/1',
            'https://hospeda.test/n/8',
            null
        ]);
    });

    it('sends one email for a single-mention submission too', async () => {
        await notify([FOUR_CHANNEL_BATCH[0]], null);

        expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    });

    it('sends NOTHING for an empty submission', async () => {
        await notify([]);

        expect(sendNotificationMock).not.toHaveBeenCalled();
        // Not even a partner lookup: there is nothing to tell anyone about.
        expect(findByIdMock).not.toHaveBeenCalled();
    });

    /**
     * Regression — smoke agosto 2026, the outbound half of H-73.
     *
     * `mentionedAt` names a DAY: the admin form is a bare date picker, so the
     * value it writes is pinned to midnight UTC. This port used to format that
     * with an explicit `timeZone: 'America/Argentina/Buenos_Aires'`, which moves
     * it to 21:00 the previous day — so the email told the PARTNER we broadcast
     * them on the 12th when the operator had entered the 13th.
     *
     * Every other case in this file uses 15:00Z, which reads as the same day in
     * both timezones and therefore could never have caught it. Midnight UTC is
     * what the real form actually produces, and the only value that separates a
     * correct implementation from the broken one.
     */
    it('dates the email on the day the operator entered, not the day before', async () => {
        const midnightUtc = new Date('2026-08-13T00:00:00.000Z');

        await notify([{ ...FOUR_CHANNEL_BATCH[0], mentionedAt: midnightUtc }], null);

        const payload = sendNotificationMock.mock.calls[0]?.[0];
        expect(payload.mentionedAtLabel).toBe('13 de agosto de 2026');
    });
});

describe('R-2 — a partner with no reachable address degrades silently', () => {
    it('skips the send when contactInfo is null entirely', async () => {
        findByIdMock.mockResolvedValue(makePartner({ contactInfo: null }));

        await expect(notify(FOUR_CHANNEL_BATCH)).resolves.toBeUndefined();

        expect(sendNotificationMock).not.toHaveBeenCalled();
        expect(warnMock).toHaveBeenCalledTimes(1);
    });

    it('skips the send when contactInfo exists but every email inside is nullish', async () => {
        findByIdMock.mockResolvedValue(
            makePartner({ contactInfo: { workEmail: null, personalEmail: null, phone: '+549' } })
        );

        await expect(notify(FOUR_CHANNEL_BATCH)).resolves.toBeUndefined();

        expect(sendNotificationMock).not.toHaveBeenCalled();
    });

    it('treats a whitespace-only address as no address', async () => {
        findByIdMock.mockResolvedValue(makePartner({ contactInfo: { workEmail: '   ' } }));

        await notify(FOUR_CHANNEL_BATCH);

        expect(sendNotificationMock).not.toHaveBeenCalled();
    });

    it('skips the send when the partner row is gone, without throwing', async () => {
        // The rows are already committed by the time this runs, so a vanished
        // partner cannot be allowed to report a logged promotion as an error.
        findByIdMock.mockResolvedValue(null);

        await expect(notify(FOUR_CHANNEL_BATCH)).resolves.toBeUndefined();

        expect(sendNotificationMock).not.toHaveBeenCalled();
        expect(warnMock).toHaveBeenCalledTimes(1);
    });
});

describe('recipient resolution', () => {
    it('honours a WORK preference', async () => {
        findByIdMock.mockResolvedValue(
            makePartner({
                contactInfo: {
                    preferredEmail: PreferredContactEnum.WORK,
                    workEmail: 'trabajo@acme.test',
                    personalEmail: 'personal@acme.test'
                }
            })
        );

        await notify(FOUR_CHANNEL_BATCH);

        expect(sendNotificationMock.mock.calls[0]?.[0].recipientEmail).toBe('trabajo@acme.test');
    });

    it('honours a HOME preference', async () => {
        findByIdMock.mockResolvedValue(
            makePartner({
                contactInfo: {
                    preferredEmail: PreferredContactEnum.HOME,
                    workEmail: 'trabajo@acme.test',
                    personalEmail: 'personal@acme.test'
                }
            })
        );

        await notify(FOUR_CHANNEL_BATCH);

        expect(sendNotificationMock.mock.calls[0]?.[0].recipientEmail).toBe('personal@acme.test');
    });

    it('falls THROUGH a preference that names an address the partner never filled in', async () => {
        // Saying "write to me at work" and then only ever entering a personal
        // address is not a reason to go silent.
        findByIdMock.mockResolvedValue(
            makePartner({
                contactInfo: {
                    preferredEmail: PreferredContactEnum.WORK,
                    workEmail: null,
                    personalEmail: 'personal@acme.test'
                }
            })
        );

        await notify(FOUR_CHANNEL_BATCH);

        expect(sendNotificationMock.mock.calls[0]?.[0].recipientEmail).toBe('personal@acme.test');
    });

    it('falls through a MOBILE preference, which names no email column at all', async () => {
        findByIdMock.mockResolvedValue(
            makePartner({
                contactInfo: {
                    preferredEmail: PreferredContactEnum.MOBILE,
                    workEmail: 'trabajo@acme.test'
                }
            })
        );

        await notify(FOUR_CHANNEL_BATCH);

        expect(sendNotificationMock.mock.calls[0]?.[0].recipientEmail).toBe('trabajo@acme.test');
    });

    it('passes a null userId for a partner with no owner account yet', async () => {
        findByIdMock.mockResolvedValue(makePartner({ ownerUserId: null }));

        await notify(FOUR_CHANNEL_BATCH);

        expect(sendNotificationMock.mock.calls[0]?.[0].userId).toBeNull();
    });
});

describe('AC-3 — the payload never carries admin-only context', () => {
    it('never puts internalNote on the wire', async () => {
        await notify(FOUR_CHANNEL_BATCH);

        const payload = sendNotificationMock.mock.calls[0]?.[0];
        expect(JSON.stringify(payload)).not.toContain('never leaves the admin surface');
    });
});
