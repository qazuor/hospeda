/**
 * Where the fake keeps the notices it sends until a test takes them, and how
 * it delivers them: honestly (one delivery, at once, on one channel, as JSON)
 * or as the real provider does (M6).
 *
 * M6, as the fake tells it (the measurement says THAT it happens, never WHEN,
 * so the pattern below is the fake's own, fixed so a test can count on it):
 * - an authorization notice rotates: the first arrives late, the second
 *   arrives at once and again late, the third never arrives, and so on;
 * - a charge notice arrives once per channel (the second channel in the form
 *   format);
 * - a refund notice arrives three times in two formats: JSON at once, JSON
 *   again late, and form-encoded on the second channel.
 * "Late" is `FAKE_NOTICE_DELAY_MS` on the injected clock.
 *
 * The simulation `noticesOutOfOrder` (not a lie: WH-3 did not observe it) hands
 * the due deliveries newest first.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import type { NoticeDelivery, ProviderNotice } from '../provider/payment-provider';
import type { FakeLieId } from './fake-lists';
import { encodeFakeNotice, type FakeNoticeFormat } from './fake-notice';

/** How late a late notice arrives: ten minutes on the injected clock. */
export const FAKE_NOTICE_DELAY_MS = 10 * 60_000;

/** The header that says which channel a delivery came by. */
export const FAKE_NOTICE_CHANNEL_HEADER = 'x-notice-channel';

/** The two channels the fake delivers by. */
export type FakeNoticeChannel = 'primary' | 'secondary';

interface Queued {
    readonly delivery: NoticeDelivery;
    readonly dueAt: number;
    readonly order: number;
}

interface Planned {
    readonly channel: FakeNoticeChannel;
    readonly format: FakeNoticeFormat;
    readonly delayMs: number;
}

const AT_ONCE: Planned = { channel: 'primary', format: 'json', delayMs: 0 };
const LATE: Planned = { ...AT_ONCE, delayMs: FAKE_NOTICE_DELAY_MS };

/** The notices the fake sent and not yet taken. */
export class FakeOutbox {
    private readonly queue: Queued[] = [];
    private order = 0;
    private authorizationNotices = 0;
    private readonly clock: Clock;
    private readonly isHonestAbout: (args: { readonly lie: FakeLieId }) => boolean;
    private readonly outOfOrder: boolean;

    /**
     * @param args.clock - The clock delays are measured on
     * @param args.isHonestAbout - Whether a test turned that lie off
     * @param args.outOfOrder - Whether the `noticesOutOfOrder` simulation is on
     */
    constructor(args: {
        readonly clock: Clock;
        readonly isHonestAbout: (args: { readonly lie: FakeLieId }) => boolean;
        readonly outOfOrder: boolean;
    }) {
        this.clock = args.clock;
        this.isHonestAbout = args.isHonestAbout;
        this.outOfOrder = args.outOfOrder;
    }

    /**
     * Sends one notice: queues its deliveries.
     *
     * @param args.notice - What changed
     * @param args.at - When the change happened; defaults to now
     */
    send(args: { readonly notice: ProviderNotice; readonly at?: number }): void {
        const at = args.at ?? this.clock.now().getTime();
        for (const planned of this.plan({ notice: args.notice })) {
            const { body, contentType } = encodeFakeNotice({
                notice: args.notice,
                format: planned.format
            });
            this.order += 1;
            this.queue.push({
                delivery: {
                    headers: {
                        'content-type': contentType,
                        [FAKE_NOTICE_CHANNEL_HEADER]: planned.channel
                    },
                    body
                },
                dueAt: at + planned.delayMs,
                order: this.order
            });
        }
    }

    /**
     * Hands over, and forgets, every delivery due by now.
     *
     * @returns The due deliveries, oldest first (newest first under `noticesOutOfOrder`)
     */
    take(): { readonly deliveries: readonly NoticeDelivery[] } {
        const now = this.clock.now().getTime();
        const due = this.queue
            .filter((queued) => queued.dueAt <= now)
            .sort((a, b) => a.dueAt - b.dueAt || a.order - b.order);
        for (const queued of due) this.queue.splice(this.queue.indexOf(queued), 1);
        const deliveries = due.map((queued) => queued.delivery);
        return { deliveries: this.outOfOrder ? deliveries.reverse() : deliveries };
    }

    /** The deliveries one notice turns into. */
    private plan(args: { readonly notice: ProviderNotice }): readonly Planned[] {
        if (!this.lying({ lie: 'M6' })) return [AT_ONCE];
        switch (args.notice.resourceKind) {
            case 'charge':
                return [AT_ONCE, { channel: 'secondary', format: 'form', delayMs: 0 }];
            case 'refund':
                return [AT_ONCE, LATE, { channel: 'secondary', format: 'form', delayMs: 0 }];
            case 'authorization': {
                const turn = this.authorizationNotices % 3;
                this.authorizationNotices += 1;
                if (turn === 0) return [LATE];
                if (turn === 1) return [AT_ONCE, LATE];
                return [];
            }
        }
    }

    private lying(args: { readonly lie: FakeLieId }): boolean {
        return !this.isHonestAbout(args);
    }
}
