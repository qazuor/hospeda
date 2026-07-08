import { createHash } from 'node:crypto';

/**
 * Fixed namespace UUID for Hospeda `example` seed fixtures.
 *
 * This value is the "namespace" input to the RFC 4122 UUIDv5 algorithm
 * (see {@link deterministicFixtureId}). It was generated once via
 * `crypto.randomUUID()` and hardcoded here.
 *
 * **THIS VALUE MUST NEVER CHANGE.** Every deterministic fixture id is a pure
 * function of `(SEED_FIXTURE_NAMESPACE, seedKey)`. Changing this constant
 * would silently reassign every `example` fixture's UUID on the next seed
 * run, breaking any versioned data-migration that targets a specific
 * fixture id (the entire reason this scheme exists — see HOS-25).
 */
export const SEED_FIXTURE_NAMESPACE = 'b17f196e-df93-4151-8e23-71487d77e4fc';

/** Canonical UUID string shape: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`. */
const UUID_HEX_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parses a canonical UUID string into its raw 16 bytes.
 *
 * @param uuid - Canonical UUID string (with or without dashes)
 * @returns 16-byte buffer representing the UUID
 * @throws {Error} If `uuid` is not a syntactically valid UUID
 */
function uuidToBytes(uuid: string): Buffer {
    if (!UUID_HEX_PATTERN.test(uuid)) {
        throw new Error(`Invalid UUID string: "${uuid}"`);
    }
    const hex = uuid.replace(/-/g, '');
    return Buffer.from(hex, 'hex');
}

/**
 * Formats a 16-byte buffer as a canonical, lowercase, dash-separated UUID string.
 *
 * @param bytes - 16-byte buffer to format
 * @returns Canonical UUID string
 */
function bytesToUuid(bytes: Buffer): string {
    const hex = bytes.toString('hex');
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32)
    ].join('-');
}

/**
 * Computes a name-based UUID (version 5) per RFC 4122 section 4.3, using
 * `node:crypto`'s SHA-1 implementation.
 *
 * Hand-rolled instead of pulling in the `uuid` npm package: `uuid` is not a
 * dependency of `@repo/seed` (nor exposed by `@repo/utils`/`@repo/db`) as of
 * this writing, and the repo's dependency policy requires flagging new
 * dependencies rather than adding them silently. `node:crypto` already
 * provides everything the v5 algorithm needs (SHA-1 hashing), so no new
 * dependency is introduced.
 *
 * @param namespace - Canonical namespace UUID string
 * @param name - Name to hash within the namespace
 * @returns Canonical UUIDv5 string derived from `namespace` and `name`
 */
function uuidV5(namespace: string, name: string): string {
    const namespaceBytes = uuidToBytes(namespace);
    const nameBytes = Buffer.from(name, 'utf8');

    const hash = createHash('sha1')
        .update(Buffer.concat([namespaceBytes, nameBytes]))
        .digest();

    // RFC 4122 uses only the first 16 bytes of the hash.
    const bytes = Buffer.from(hash.subarray(0, 16));

    // Set version to 5 (0b0101) in the high nibble of byte 6.
    const versionByte = bytes[6];
    bytes[6] = versionByte === undefined ? 0x50 : (versionByte & 0x0f) | 0x50;

    // Set variant to RFC 4122 (0b10xxxxxx) in the high bits of byte 8.
    const variantByte = bytes[8];
    bytes[8] = variantByte === undefined ? 0x80 : (variantByte & 0x3f) | 0x80;

    return bytesToUuid(bytes);
}

/**
 * Input for {@link deterministicFixtureId}.
 */
interface DeterministicFixtureIdInput {
    /**
     * Stable string that identifies a seed fixture across runs and
     * processes. By convention this is derived from the fixture's own
     * top-level `id` field in its JSON file (e.g. the entity name plus the
     * fixture's `id`, such as `"accommodation:001-hotel-plaza"`), so the
     * same fixture always maps to the same UUID regardless of seed order.
     */
    seedKey: string;
}

/**
 * Derives a deterministic UUIDv5 for an `example` seed fixture from its
 * stable seed key.
 *
 * The same `seedKey` always produces the same UUID, in any process and on
 * any machine, because the algorithm is a pure function of
 * `(SEED_FIXTURE_NAMESPACE, seedKey)` with no randomness involved. This lets
 * versioned data-migrations reference specific example records by a fixed
 * id instead of a randomly-assigned one.
 *
 * @param input - RO-RO input containing the fixture's stable seed key
 * @returns Canonical UUIDv5 string
 *
 * @example
 * ```ts
 * deterministicFixtureId({ seedKey: 'accommodation:001-hotel-plaza' });
 * // => same UUID every time, e.g. "3f9a1c2e-....-5..."
 * ```
 *
 * @throws {TypeError} If `seedKey` is not a non-empty string
 */
export function deterministicFixtureId(input: DeterministicFixtureIdInput): string {
    const { seedKey } = input;

    if (typeof seedKey !== 'string' || seedKey.length === 0) {
        throw new TypeError('deterministicFixtureId: "seedKey" must be a non-empty string');
    }

    return uuidV5(SEED_FIXTURE_NAMESPACE, seedKey);
}
