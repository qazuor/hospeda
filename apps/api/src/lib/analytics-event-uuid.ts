import { createHash } from 'node:crypto';

/**
 * Stable UUIDv5 namespace for analytics event deduplication. Changing this
 * namespace breaks deduplication against events already sent to PostHog.
 */
const ANALYTICS_EVENT_NAMESPACE = '9b2a56d8-3357-5f6f-9e32-95d4fcdfd2e9';

/** Creates a UUIDv5 from a stable name and namespace.
 * @param input.name - Stable event identity to hash.
 * @param input.namespace - UUID namespace to hash under.
 * @returns A deterministic UUIDv5 string.
 */
export function uuidv5(input: { name: string; namespace: string }): string {
    const { name, namespace } = input;
    const namespaceBytes = Buffer.from(namespace.replaceAll('-', ''), 'hex');
    const hash = createHash('sha1').update(namespaceBytes).update(name).digest();
    hash.writeUInt8((hash.readUInt8(6) & 0x0f) | 0x50, 6);
    hash.writeUInt8((hash.readUInt8(8) & 0x3f) | 0x80, 8);
    const hex = hash.subarray(0, 16).toString('hex');
    return (
        hex.slice(0, 8) +
        '-' +
        hex.slice(8, 12) +
        '-' +
        hex.slice(12, 16) +
        '-' +
        hex.slice(16, 20) +
        '-' +
        hex.slice(20)
    );
}

/** Derives a stable event UUID from its name and deduplication key.
 * @param input.event - Analytics event name.
 * @param input.dedupeKey - Identity of the persisted fact.
 * @returns A deterministic UUIDv5 string.
 */
export function deriveAnalyticsEventUuid(input: { event: string; dedupeKey: string }): string {
    return uuidv5({
        name: `${input.event}:${input.dedupeKey}`,
        namespace: ANALYTICS_EVENT_NAMESPACE
    });
}
