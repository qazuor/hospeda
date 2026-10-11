import type {
    AuthorizationSearchInput,
    AuthorizationSearchResult,
    AuthorizationSummary
} from '../provider/payment-provider';
import type { StoredAuthorization } from './fake-support';

/** Searches stored authorizations, optionally reproducing the measured partial-search behaviour. */
export function searchStoredAuthorizations(args: {
    readonly stored: Iterable<StoredAuthorization>;
    readonly input: AuthorizationSearchInput;
    readonly partial: boolean;
}): AuthorizationSearchResult {
    const matches = [...args.stored]
        .filter(
            ({ snapshot }) =>
                (args.partial ||
                    args.input.reference === undefined ||
                    snapshot.reference === args.input.reference) &&
                (args.input.status === undefined || snapshot.status === args.input.status)
        )
        .filter((_, index) => !args.partial || args.input.status === undefined || index % 2 === 0)
        .map(
            ({ snapshot }): AuthorizationSummary => ({
                authorizationId: snapshot.authorizationId,
                reference: snapshot.reference,
                status: snapshot.status
            })
        );
    return { authorizations: matches };
}
