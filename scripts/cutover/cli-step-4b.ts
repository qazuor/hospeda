import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CliDeps } from './cli-main.ts';
import { runStep4b } from './run-step-4b.ts';
import type { CutoverManifest } from './types.ts';
import { createManifestWriter } from './write-manifest.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VAR_TOKEN = 'CUTOVER_MP_ACCESS_TOKEN';
const VAR_NEW_DB = 'CUTOVER_NEW_DATABASE_URL';
const VAR_CARD = 'CUTOVER_CARD_TOKEN';
const VAR_EMAIL = 'CUTOVER_PAYER_EMAIL';
const VAR_METHOD = 'CUTOVER_PAYMENT_METHOD_ID';

const dumpManifest =
    ({ err }: { readonly err: (line: string) => void }) =>
    (text: string): void => {
        err('MANIFEST WRITE FAILED. Full record follows; save it now:');
        err(text);
    };

/** Runs the explicitly confirmed, bounded-payment step-4b mode. */
export async function runStep4bCli({
    deps,
    confirmed,
    amountText,
    manifestOut
}: {
    readonly deps: CliDeps;
    readonly confirmed: boolean;
    readonly amountText: string | undefined;
    readonly manifestOut: string | undefined;
}): Promise<number> {
    const { err, out, session } = deps;
    if (!confirmed) {
        err('refusing to run step 4b without --confirm-step-4b');
        return 2;
    }
    if (amountText === undefined || !/^\d+$/.test(amountText)) {
        err('--payment-amount must be an integer from 15 to 1000');
        return 2;
    }
    const amountArs = Number(amountText);
    if (!Number.isSafeInteger(amountArs) || amountArs < 15 || amountArs > 1000) {
        err('--payment-amount must be an integer from 15 to 1000');
        return 2;
    }
    const required = [VAR_TOKEN, VAR_NEW_DB, VAR_CARD, VAR_EMAIL, VAR_METHOD] as const;
    const missing = required.filter((name) => !session[name]);
    if (missing.length > 0) {
        err(`set ${missing.join(', ')} in this shell session`);
        return 2;
    }
    const accessToken = session[VAR_TOKEN];
    const connectionString = session[VAR_NEW_DB];
    const cardToken = session[VAR_CARD];
    const payerEmail = session[VAR_EMAIL];
    const paymentMethodId = session[VAR_METHOD];
    if (!accessToken || !connectionString || !cardToken || !payerEmail || !paymentMethodId)
        return 2;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const writer = createManifestWriter({
        wantedPath:
            manifestOut ??
            path.join(repoRoot, 'scripts/cutover/out', `cutover-4b-manifest-${stamp}.json`),
        fallback: dumpManifest({ err })
    });
    const result = await runStep4b({
        api: deps.createApi({ accessToken }),
        readDelivery: deps.createDeliveryReader({ connectionString }),
        payment: { amountArs, cardToken, payerEmail, paymentMethodId },
        sleep: deps.sleep,
        onCheckpoint: (manifest: CutoverManifest) => writer.write(manifest).writtenTo !== null
    });
    const { writtenTo } = writer.write(result.manifest);
    const { manifest } = result;
    out(
        `outcome=${manifest.outcome} probe=${manifest.probeId ?? '-'} payment=${manifest.paymentId ?? '-'} refund=${manifest.refundId ?? '-'} manifest=${writtenTo ?? 'NOT WRITTEN (see stderr)'}`
    );
    for (const failure of manifest.failures) {
        err(`FAIL ${failure.code}${failure.id ? ` ${failure.id}` : ''}: ${failure.detail}`);
    }
    return result.ok && writtenTo !== null ? 0 : 1;
}
