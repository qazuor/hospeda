/**
 * Typed-confirmation plumbing shared by every prompt-gated command (HOS-1963).
 *
 * Two problems, one module:
 *
 * 1. `@clack/prompts` reads the keyboard from the TTY. Fed through a pipe
 *    (`echo phrase | hops ...`) it renders the prompt and then exits WITHOUT
 *    answering, and the command ends having written nothing and complained
 *    about nothing: the operator reads "confirmed" and the table is empty.
 *    {@link ttyRefusal} lets the prompt wrappers refuse that case loudly.
 * 2. Scripted runs still need a way to confirm. `--confirm-phrase=<phrase>`
 *    supplies the phrase on the command line; it must equal the phrase the
 *    prompt would have asked for, exactly, so it costs the same as typing it
 *    and stays in the shell history. {@link confirmTypedPhrase} is the single
 *    place that decides.
 *
 * Pure: no I/O, no `process` access.
 *
 * @module lib/typed-confirmation
 */

/** Name of the flag that answers a typed prompt non-interactively. */
export const CONFIRM_PHRASE_FLAG = '--confirm-phrase';

/**
 * Explain why a prompt cannot run, or return `undefined` when it can.
 *
 * @param input - Whether stdin and stdout are TTYs, and what is being asked.
 * @returns The refusal message, or `undefined` when both streams are TTYs.
 */
export function ttyRefusal(input: {
    readonly stdinIsTty: boolean | undefined;
    readonly stdoutIsTty: boolean | undefined;
    readonly message: string;
}): string | undefined {
    if (input.stdinIsTty === true && input.stdoutIsTty === true) return undefined;
    return (
        `Cannot ask "${input.message}": stdin/stdout is not a TTY, so the prompt would be skipped ` +
        `without an answer. Run it from a terminal (ssh -t), or pass ${CONFIRM_PHRASE_FLAG}=<phrase> ` +
        'where the command accepts it. Nothing was done.'
    );
}

/** Outcome of {@link confirmTypedPhrase}. */
export type TypedPhraseResult =
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: string };

/**
 * Check a typed confirmation against the phrase the command requires.
 *
 * With `provided` (from {@link CONFIRM_PHRASE_FLAG}) no prompt is shown and
 * the value must equal `expected` exactly: no trimming, no case folding. A
 * wrong value aborts; it never falls back to prompting. Without it, `ask` is
 * called and the typed text gets the same exact comparison.
 *
 * @param input - The required phrase, the flag value if any, and the prompt.
 * @returns `{ ok: true }` or the reason the confirmation is rejected.
 */
export async function confirmTypedPhrase(input: {
    readonly expected: string;
    readonly provided: string | undefined;
    readonly ask: () => Promise<string>;
}): Promise<TypedPhraseResult> {
    if (input.provided !== undefined) {
        return input.provided === input.expected
            ? { ok: true }
            : {
                  ok: false,
                  reason: `${CONFIRM_PHRASE_FLAG} does not match the required phrase '${input.expected}'.`
              };
    }
    const typed = await input.ask();
    return typed === input.expected
        ? { ok: true }
        : { ok: false, reason: 'Aborted: typed confirmation did not match.' };
}
