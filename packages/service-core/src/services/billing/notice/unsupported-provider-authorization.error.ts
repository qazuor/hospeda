/**
 * An unsupported foreign provider authorization that was acknowledged by the webhook receiver.
 */
export class UnsupportedProviderAuthorizationError extends Error {
    readonly authorizationId: string;
    readonly chargeId?: string;
    readonly providerStatus?: string;
    readonly providerCadence?: string;
    readonly correlationId: string;

    constructor(input: {
        readonly authorizationId: string;
        readonly chargeId?: string;
        readonly providerStatus?: string;
        readonly providerCadence?: string;
        readonly correlationId: string;
        readonly cause: unknown;
    }) {
        super(`Ignored unsupported foreign provider authorization ${input.authorizationId}`, {
            cause: input.cause
        });
        this.name = 'UnsupportedProviderAuthorizationError';
        this.authorizationId = input.authorizationId;
        this.chargeId = input.chargeId;
        this.providerStatus = input.providerStatus;
        this.providerCadence = input.providerCadence;
        this.correlationId = input.correlationId;
    }
}
