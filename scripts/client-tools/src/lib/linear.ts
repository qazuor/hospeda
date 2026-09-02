import { loadApiKeys } from './linear-auth.ts';

/** Linear's GraphQL endpoint. */
const API = 'https://api.linear.app/graphql';

/** The fields `start-issue` needs to name a branch and brief the user. */
export interface LinearIssue {
    /** Identifier, e.g. `HOS-273`. */
    readonly identifier: string;
    /** Issue title. */
    readonly title: string;
    /** Workflow state name, e.g. `Backlog`. */
    readonly stateName: string;
    /** Workflow state type, e.g. `backlog`, `started`, `completed`, `canceled`. */
    readonly stateType: string;
    /** Label names attached to the issue. */
    readonly labels: readonly string[];
    /** Web URL of the issue. */
    readonly url: string;
}

/** Either the issue, or the reason it could not be fetched. */
export type IssueLookup =
    | { readonly ok: true; readonly issue: LinearIssue }
    | { readonly ok: false; readonly reason: string };

const QUERY = `query($id:String!){
  issue(id:$id){
    identifier title url
    state{ name type }
    labels{ nodes{ name } }
  }
}`;

interface RawIssue {
    readonly identifier: string;
    readonly title: string;
    readonly url: string;
    readonly state: { readonly name: string; readonly type: string } | null;
    readonly labels: { readonly nodes: readonly { readonly name: string }[] } | null;
}

/**
 * Fetches one issue by identifier.
 *
 * Every stored key is tried in turn, and the failure names WHICH key was
 * rejected: a stale `LINEAR_API_KEY` in the environment used to shadow a
 * perfectly good config file and the error blamed Linear for it.
 *
 * @param input.issueId - Canonical identifier, e.g. `HOS-273`.
 * @returns The issue, or the reason the lookup failed.
 */
export async function fetchIssue({ issueId }: { readonly issueId: string }): Promise<IssueLookup> {
    const keys = await loadApiKeys();
    if (keys.length === 0) {
        return { ok: false, reason: 'no hay ninguna LINEAR_API_KEY configurada' };
    }

    const rejected: string[] = [];
    for (const { key, origin } of keys) {
        let response: Response;
        try {
            response = await fetch(API, {
                method: 'POST',
                headers: { Authorization: key, 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: QUERY, variables: { id: issueId } }),
                signal: AbortSignal.timeout(20_000)
            });
        } catch (error) {
            return {
                ok: false,
                reason: `no se pudo contactar a Linear: ${(error as Error).message}`
            };
        }

        const body = (await response.json()) as {
            data?: { issue: RawIssue | null };
            errors?: { message: string }[];
        };

        const firstError = body.errors?.[0]?.message;
        if (firstError !== undefined) {
            // "Entity not found" means the key WORKED and the issue does not
            // exist. Filing it as a rejected key sends the reader to rotate a
            // perfectly good credential over a typo in an issue number.
            if (/entity not found/i.test(firstError)) {
                return { ok: false, reason: `Linear no conoce el issue ${issueId}` };
            }
            rejected.push(`${origin}: ${firstError}`);
            continue;
        }

        const raw = body.data?.issue;
        if (raw === null || raw === undefined) {
            return { ok: false, reason: `Linear no conoce el issue ${issueId}` };
        }

        return {
            ok: true,
            issue: {
                identifier: raw.identifier,
                title: raw.title,
                url: raw.url,
                stateName: raw.state?.name ?? '(sin estado)',
                stateType: raw.state?.type ?? 'unknown',
                labels: (raw.labels?.nodes ?? []).map((node) => node.name)
            }
        };
    }

    return { ok: false, reason: `Linear rechazó todas las claves —\n  ${rejected.join('\n  ')}` };
}
