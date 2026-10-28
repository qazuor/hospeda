import type { ReadOnlyClient } from './known-ids.ts';
import type { StagingSandboxApi } from './staging-sandbox-api.ts';
import { TEST_ACCOUNT_TAG } from './staging-sandbox-api.ts';

/** The only `--target` this run accepts. */
export const STAGING_TARGET = 'staging';

/**
 * Name of the staging database, as provisioned in Coolify
 * (`scripts/server-tools/src/lib/target.ts`, `DB_CREDENTIAL_DEFAULTS.staging`). Production's is
 * `postgres`. Read from the server with `current_database()`, never parsed from the URL.
 */
export const STAGING_DATABASE_NAME = 'hospeda_staging';

/** Raised when the run cannot PROVE it is pointed at the staging database and the sandbox. */
export class EnvironmentRefusal extends Error {
    public constructor({ message }: { readonly message: string }) {
        super(message);
        this.name = 'EnvironmentRefusal';
    }
}

/**
 * Fail-closed check of the token: the account behind it must carry the test tag. A read that
 * fails, an answer without tags, or a production account all refuse.
 *
 * @param input - the sandbox reads
 * @throws EnvironmentRefusal when the account is not proven to be a test account
 */
export async function assertSandboxAccount({
    api
}: {
    readonly api: StagingSandboxApi;
}): Promise<void> {
    let tags: readonly string[];
    try {
        tags = await api.readAccountTags();
    } catch {
        throw new EnvironmentRefusal({
            message: 'could not read the provider account behind the token; refusing to run'
        });
    }
    if (!tags.includes(TEST_ACCOUNT_TAG)) {
        throw new EnvironmentRefusal({
            message: `the provider account behind the token has no '${TEST_ACCOUNT_TAG}' tag: it is not the sandbox. Refusing to run`
        });
    }
}

/**
 * Fail-closed check of the database: the server must answer `current_database()` with the
 * staging name. Any other name, an empty answer or a failed query refuse.
 *
 * @param input - a connected read-only client
 * @throws EnvironmentRefusal when the database is not proven to be staging's
 */
export async function assertStagingDatabase({
    client
}: {
    readonly client: ReadOnlyClient;
}): Promise<void> {
    let name: unknown;
    try {
        const answer = await client.query('SELECT current_database() AS name');
        name = answer.rows[0]?.name;
    } catch {
        throw new EnvironmentRefusal({
            message: 'could not read the database name; refusing to run'
        });
    }
    if (name !== STAGING_DATABASE_NAME) {
        throw new EnvironmentRefusal({
            message: `the database is not '${STAGING_DATABASE_NAME}'; refusing to run`
        });
    }
}

/**
 * Fail-closed check of the explicit flag: `--target=staging` and nothing else.
 *
 * @param input - the `--target` value, if any
 * @throws EnvironmentRefusal when the flag is missing or names another target
 */
export function assertStagingTarget({ target }: { readonly target: string | undefined }): void {
    if (target !== STAGING_TARGET) {
        throw new EnvironmentRefusal({
            message: `--target=${STAGING_TARGET} is required; refusing to run`
        });
    }
}
