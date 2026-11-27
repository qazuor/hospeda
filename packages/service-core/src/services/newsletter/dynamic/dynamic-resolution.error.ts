/** Stable failure codes for dynamic resolver configuration and adapter wiring. */
export type DynamicResolutionErrorCode =
    | 'DYNAMIC_ENTITY_TYPE_MISMATCH'
    | 'SOURCE_NOT_SUPPORTED_FOR_ENTITY'
    | 'ENTITY_TYPE_NOT_ENABLED'
    | 'INVALID_SITE_URL'
    | 'DUPLICATE_DYNAMIC_BLOCK_KEY';

/** Typed configuration failure; below-minimum outcomes are returned, not thrown. */
export class DynamicResolutionError extends Error {
    readonly code: DynamicResolutionErrorCode;

    /** Attach a stable code for callers to map without parsing prose. */
    constructor(input: { readonly code: DynamicResolutionErrorCode }) {
        super(input.code);
        this.name = 'DynamicResolutionError';
        this.code = input.code;
    }
}
