import type { ILogger } from '@repo/logger';
import type { AlertDigestPayload } from '../types/alert.types.js';

/**
 * Channel-agnostic delivery contract for the alerts & offers daily digest
 * (SPEC-286 T-008).
 *
 * Implement this interface to add a new delivery transport (e.g. WhatsApp,
 * push notifications) WITHOUT touching `AlertDigestDeliveryService`,
 * `AlertSubscriptionService`, or the price-drop/promo-offer evaluators.
 * `AlertDigestDeliveryService` only knows about this interface — it has no
 * awareness of email, WhatsApp, or any other concrete transport.
 */
export interface NotificationChannel {
    /** Stable identifier for the channel, used in structured logging. */
    readonly name: string;
    /**
     * Deliver a single user's digest payload through this channel.
     *
     * Implementations MUST NOT throw for expected "nothing to send" cases
     * (e.g. an empty payload) — they should resolve silently instead.
     * Unexpected failures (network errors, provider errors) MAY throw;
     * `AlertDigestDeliveryService.deliver()` isolates per-channel errors so
     * one failing channel never prevents delivery through the others.
     *
     * @param payload - The combined price-drop + promo-offer digest for one user.
     */
    deliver(payload: AlertDigestPayload): Promise<void>;
}

/**
 * Orchestrates delivery of the alerts & offers daily digest across every
 * registered {@link NotificationChannel}.
 *
 * This class is deliberately independent from `NotificationService`
 * (`packages/notifications/src/services/notification.service.ts`), which is a
 * monolithic per-notification-type sender coupled to email templates. This
 * class instead exists to let the SPEC-286 alerts-digest cron (T-007) fan a
 * single payload out to multiple channels (email today, WhatsApp/push in the
 * future) without any of those future channels needing to touch the
 * subscription (`AlertSubscriptionService`) or evaluation
 * (`PriceDropEvaluator`, `PromoOfferEvaluator`) core.
 *
 * @example
 * ```ts
 * const deliveryService = new AlertDigestDeliveryService({
 *   channels: [new EmailAlertChannel({ transport: resendTransport, logger })],
 *   logger
 * });
 *
 * await deliveryService.deliver({
 *   userId: 'user-123',
 *   userEmail: 'user@example.com',
 *   locale: 'es',
 *   priceDrop: [...],
 *   promoOffers: []
 * });
 * ```
 */
export class AlertDigestDeliveryService {
    private readonly channels: NotificationChannel[];
    private readonly logger: ILogger;

    /**
     * @param deps - Constructor dependencies.
     * @param deps.channels - The list of channels to fan out to. Required
     * (no implicit default). Instantiating a default `[EmailAlertChannel]`
     * here would force this class to eagerly construct a live
     * `EmailTransport` at class-definition time, which is awkward for a
     * shared service module — the production default wiring (currently just
     * email) is the caller's responsibility (SPEC-286 T-007, the
     * alerts-digest cron), not this class's.
     * @param deps.logger - Logger used for structured per-channel error logging.
     */
    constructor(deps: { channels: NotificationChannel[]; logger: ILogger }) {
        this.channels = deps.channels;
        this.logger = deps.logger;
    }

    /**
     * Delivers a single user's digest payload through every registered
     * channel.
     *
     * Each channel is invoked independently — if one channel throws, the
     * error is logged and the remaining channels still run (error
     * isolation). This method never rejects.
     *
     * @param payload - The combined price-drop + promo-offer digest for one user.
     */
    async deliver(payload: AlertDigestPayload): Promise<void> {
        for (const channel of this.channels) {
            try {
                await channel.deliver(payload);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                this.logger.error(
                    { channel: channel.name, userId: payload.userId, error: errorMessage },
                    'Failed to deliver alert digest through channel'
                );
            }
        }
    }

    /**
     * Delivers multiple users' digest payloads sequentially.
     *
     * Delegates to {@link deliver} for each payload, so per-channel and
     * per-user error isolation both hold — one user's failed delivery never
     * prevents the next user's digest from being processed.
     *
     * @param payloads - One digest payload per user.
     */
    async deliverBatch(payloads: AlertDigestPayload[]): Promise<void> {
        for (const payload of payloads) {
            await this.deliver(payload);
        }
    }
}
