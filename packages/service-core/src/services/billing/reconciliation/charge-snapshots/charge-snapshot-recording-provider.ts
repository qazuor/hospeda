import { createLogger } from '@repo/logger';
import type { ChargeSnapshot, PaymentProvider, ProviderRead } from '@repo/payments';
import type { ChargeSnapshotRecorder } from './charge-snapshot-recorder';

const logger = createLogger('charge-snapshot-recorder');
const WRAPPED = Symbol('charge-snapshot-recording-provider');

/** Decorate live charge reads with best-effort snapshot recording. */
export function createChargeSnapshotRecordingProvider(input: {
    readonly provider: PaymentProvider;
    readonly recorder: ChargeSnapshotRecorder;
}): PaymentProvider {
    if ((input.provider as PaymentProvider & { [WRAPPED]?: boolean })[WRAPPED])
        return input.provider;
    const wrapped = new Proxy(input.provider, {
        get(target, property) {
            const value = Reflect.get(target, property, target) as unknown;
            if (property === 'readCharge' && typeof value === 'function')
                return async (...args: unknown[]) => {
                    const read = await (
                        value as (...items: unknown[]) => Promise<ProviderRead<ChargeSnapshot>>
                    ).apply(target, args);
                    try {
                        await input.recorder.record({ read });
                    } catch (error) {
                        logger.warn({ error }, 'Could not record provider charge snapshot');
                    }
                    return read;
                };
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
    Object.defineProperty(wrapped, WRAPPED, { value: true });
    return wrapped;
}
