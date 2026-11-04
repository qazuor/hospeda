import { createLogger } from '@repo/logger';
import type { ChargeSnapshot, PaymentProvider, ProviderRead } from '@repo/payments';
import type { ChargeSnapshotRecorder } from './charge-snapshot-recorder';

const logger = createLogger('charge-snapshot-recorder');
/** Proxies this module made. A marker property would land on the target (no defineProperty trap). */
const RECORDING_PROXIES = new WeakSet<object>();

/** Decorate live charge reads with best-effort snapshot recording. */
export function createChargeSnapshotRecordingProvider(input: {
    readonly provider: PaymentProvider;
    readonly recorder: ChargeSnapshotRecorder;
}): PaymentProvider {
    if (RECORDING_PROXIES.has(input.provider)) return input.provider;
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
    RECORDING_PROXIES.add(wrapped);
    return wrapped;
}
