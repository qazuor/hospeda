/**
 * Target policy enforcement for `hops` commands.
 *
 * This module owns the decision logic that maps a (command policy, target
 * source, interactive mode) tuple to a concrete action. The action is
 * returned as a discriminated union so the caller (`src/index.ts`) can
 * execute it — prompting, dying, or proceeding — without this module
 * calling `process.exit` or `promptForTarget` directly. That separation
 * makes the logic trivially unit-testable.
 *
 * ## Decision matrix
 *
 * | policy             | source   | interactive | action  |
 * |--------------------|----------|-------------|---------|
 * | none               | any      | any         | skip    |
 * | explicit-required  | flag     | any         | run     |
 * | explicit-required  | env      | any         | die     |
 * | explicit-required  | none     | false       | die     |
 * | explicit-required  | none     | true        | prompt  |
 * | default-ok         | flag     | any         | run     |
 * | default-ok         | env      | any         | warn    |
 * | default-ok         | none     | false       | die     |
 * | default-ok         | none     | true        | prompt  |
 */

import type { Target, TargetPolicy, TargetSource } from './target.ts';

/**
 * The command has no prod/staging concept — no target is needed or set.
 */
export interface PolicyDecisionSkip {
    readonly action: 'skip';
}

/**
 * A valid target was resolved and the command may run.
 * For `default-ok` with `source === 'env'`, a loud warning should be
 * printed before running (the `warn` flag is set to `true`).
 */
export interface PolicyDecisionRun {
    readonly action: 'run';
    /** The resolved target the caller must set before executing the command. */
    readonly target: Target;
    /**
     * When `true` the caller should log a visible warning noting that the
     * target came from `HOPS_DEFAULT_TARGET`. Only ever `true` for
     * `default-ok` + `source === 'env'`.
     */
    readonly warn: boolean;
}

/**
 * No valid target could be determined without human input.
 * The caller must invoke an interactive `promptForTarget()` and then
 * proceed as `run`.
 */
export interface PolicyDecisionPrompt {
    readonly action: 'prompt';
}

/**
 * Policy was violated — the caller must die() with the given message.
 */
export interface PolicyDecisionDie {
    readonly action: 'die';
    readonly message: string;
}

/**
 * Discriminated union of all possible policy decisions.
 */
export type PolicyDecision =
    | PolicyDecisionSkip
    | PolicyDecisionRun
    | PolicyDecisionPrompt
    | PolicyDecisionDie;

/**
 * Input to {@link evaluateTargetPolicy}.
 */
export interface EvaluateTargetPolicyInput {
    /** The target policy declared by the command. */
    readonly policy: TargetPolicy;
    /** The command's kebab-case name (used in die messages). */
    readonly commandName: string;
    /** Resolved target, or `undefined` when no source provided one. */
    readonly target: Target | undefined;
    /** Where the target value came from. */
    readonly source: TargetSource;
    /**
     * Whether the CLI is in interactive mode (no command given on argv —
     * the user picked from the menu). In interactive mode an
     * `explicit-required` or `default-ok` command with no target can
     * prompt the operator instead of dying immediately.
     */
    readonly interactive: boolean;
}

/**
 * Evaluate the target policy for a command and return a decision object.
 *
 * This is a pure function with no side effects. It never calls
 * `process.exit`, `console.log`, or any I/O function — it only returns
 * what the caller should do. That makes it trivially unit-testable.
 *
 * @param input - Policy evaluation parameters.
 * @returns A {@link PolicyDecision} describing the action the caller must take.
 *
 * @example
 * ```ts
 * const decision = evaluateTargetPolicy({
 *   policy: 'explicit-required',
 *   commandName: 'db-migrate',
 *   target: 'staging',
 *   source: 'flag',
 *   interactive: false,
 * });
 * // => { action: 'run', target: 'staging', warn: false }
 * ```
 */
export function evaluateTargetPolicy(input: EvaluateTargetPolicyInput): PolicyDecision {
    const { policy, commandName, target, source, interactive } = input;

    if (policy === 'none') {
        return { action: 'skip' };
    }

    if (policy === 'explicit-required') {
        if (source === 'flag') {
            // A valid, explicit flag was provided — safe to proceed.
            return { action: 'run', target: target as Target, warn: false };
        }
        if (source === 'env') {
            // HOPS_DEFAULT_TARGET is deliberately ignored for write commands.
            return {
                action: 'die',
                message: `'${commandName}' writes or destroys data and requires an explicit --target= flag.\n  HOPS_DEFAULT_TARGET is not honoured for this command to prevent accidents.\n  Usage: hops --target=<prod|staging> ${commandName} [args]\n  Valid targets: prod | staging`
            };
        }
        // source === 'none'
        if (interactive) {
            // Operator is already in the interactive picker — a human prompt
            // counts as an explicit choice.
            return { action: 'prompt' };
        }
        return {
            action: 'die',
            message: `'${commandName}' writes or destroys data and requires an explicit --target= flag.\n  HOPS_DEFAULT_TARGET is not honoured for this command to prevent accidents.\n  Usage: hops --target=<prod|staging> ${commandName} [args]\n  Valid targets: prod | staging`
        };
    }

    // policy === 'default-ok'
    if (source === 'flag') {
        return { action: 'run', target: target as Target, warn: false };
    }

    if (source === 'env') {
        // Print a loud warning so the operator always knows which environment
        // they hit, then proceed.
        return { action: 'run', target: target as Target, warn: true };
    }

    // source === 'none'
    if (interactive) {
        return { action: 'prompt' };
    }
    return {
        action: 'die',
        message: `'${commandName}' needs a target environment but none was provided.\n  Pass --target=<prod|staging> or set HOPS_DEFAULT_TARGET in .env.local.\n  Valid targets: prod | staging`
    };
}
