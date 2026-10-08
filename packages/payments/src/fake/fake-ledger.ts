/**
 * The fake provider's books: the authorizations and charges it holds, their
 * versions, and the notices each change sends through the outbox. It tells no
 * lie itself: the provider decides what to write and whether to notify.
 */
import type { PaymentCapability } from '../provider/capabilities';
import type { NoticeResourceKind } from '../provider/payment-provider';
import type { FakeOutbox } from './fake-outbox';
import { notFound, type StoredAuthorization, type StoredCharge } from './fake-support';

/** The records of one fake provider. */
export class FakeLedger {
    readonly authorizations = new Map<string, StoredAuthorization>();
    readonly charges = new Map<string, StoredCharge>();
    private sequence = 0;
    private readonly outbox: FakeOutbox;

    /**
     * @param args.outbox - Where the notices of each change go
     */
    constructor(args: { readonly outbox: FakeOutbox }) {
        this.outbox = args.outbox;
    }

    /**
     * The authorization with that id.
     *
     * @throws PaymentProviderError with code `NOT_FOUND`
     */
    authorizationOrThrow(args: {
        readonly id: string;
        readonly capability: PaymentCapability;
    }): StoredAuthorization {
        const stored = this.authorizations.get(args.id);
        if (!stored) throw notFound({ capability: args.capability, id: args.id });
        return stored;
    }

    /**
     * The charge with that id.
     *
     * @throws PaymentProviderError with code `NOT_FOUND`
     */
    chargeOrThrow(args: {
        readonly id: string;
        readonly capability: PaymentCapability;
    }): StoredCharge {
        const stored = this.charges.get(args.id);
        if (!stored) throw notFound({ capability: args.capability, id: args.id });
        return stored;
    }

    /**
     * Records one change of a resource: its version moves, and, unless told
     * not to, a notice says so.
     *
     * @param args.at - When the change happened; defaults to now
     */
    bump(args: {
        readonly stored: StoredAuthorization | StoredCharge;
        readonly resourceKind: NoticeResourceKind;
        readonly resourceId: string;
        readonly notify?: boolean;
        readonly at?: number;
    }): void {
        args.stored.version += 1;
        if (args.notify === false) return;
        this.emit({
            resourceKind: args.resourceKind,
            resourceId: args.resourceId,
            version: args.stored.version,
            at: args.at
        });
    }

    /** Sends the notice of a resource at a version. */
    emit(args: {
        readonly resourceKind: NoticeResourceKind;
        readonly resourceId: string;
        readonly version: number;
        readonly at?: number;
    }): void {
        this.outbox.send({
            notice: {
                resourceKind: args.resourceKind,
                resourceId: args.resourceId,
                version: String(args.version)
            },
            at: args.at
        });
    }

    /** A new id, unique within this fake. */
    nextId(args: { readonly prefix: string }): string {
        this.sequence += 1;
        return `fake-${args.prefix}-${this.sequence}`;
    }
}
