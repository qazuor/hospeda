/**
 * @repo/media/test-utils — test doubles for the media package.
 *
 * The in-memory {@link InMemoryImageProvider} satisfies the full
 * {@link ImageProvider} contract without any network I/O, so tests and local
 * dev fallback paths can upload/delete assets deterministically.
 *
 * This entrypoint is intentionally kept tiny so bundlers never accidentally
 * pull a test double into production output: consumers must request it
 * explicitly via the `@repo/media/test-utils` subpath.
 */

export { InMemoryImageProvider } from './mock-provider.js';
export type {
    InMemoryImageProviderOptions,
    InMemoryImageRecord
} from './mock-provider.js';
