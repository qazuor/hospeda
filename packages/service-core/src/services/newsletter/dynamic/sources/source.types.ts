import type { ServiceContext } from '../../../../types/index.js';
import type { FetchCandidatesInput } from '../dynamic-source.port.js';

/** Query context shared by the registered accommodation sources. */
export interface SourceResolverInput extends FetchCandidatesInput {
    readonly ctx?: ServiceContext;
}

/** Ordered candidate query for one supported entity/source pair. */
export type SourceResolver = (input: SourceResolverInput) => Promise<readonly string[]>;
