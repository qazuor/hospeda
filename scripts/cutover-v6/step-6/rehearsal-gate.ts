import { diffFingerprints, fingerprintSchema, type SchemaClient } from './schema-fingerprint.ts';

export class RehearsalMismatchError extends Error {
    readonly differences: readonly string[];

    constructor(differences: readonly string[]) {
        super(
            `Step 6 rehearsal differs; database ledgers were not written:\n${differences.join('\n')}`
        );
        this.name = 'RehearsalMismatchError';
        this.differences = differences;
    }
}

export async function assertRehearsalMatches({
    cutClient,
    builtClient
}: {
    readonly cutClient: SchemaClient;
    readonly builtClient: SchemaClient;
}): Promise<void> {
    const differences = diffFingerprints({
        a: await fingerprintSchema({ client: cutClient }),
        b: await fingerprintSchema({ client: builtClient })
    });
    if (differences.length) throw new RehearsalMismatchError(differences);
}
