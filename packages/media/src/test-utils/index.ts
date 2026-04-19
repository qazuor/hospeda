/**
 * @repo/media/test-utils — placeholder barrel.
 *
 * The actual in-memory test provider (`InMemoryImageProvider`) lands in
 * SPEC-078-GAPS T-018 (GAP-078-102). This file exists now so that the
 * package's `exports` map and the rest of the consumer migration can land
 * without waiting for the mock implementation.
 *
 * Do not add runtime code here in T-017 — keep the entry empty so bundlers
 * never pull the (not-yet-existing) mock into production output by accident.
 */

export {};
