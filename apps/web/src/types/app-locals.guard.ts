/**
 * SPEC-218 regression guard for the `App.Locals` augmentation.
 *
 * The `App.Locals` interface is augmented in `apps/web/src/env.d.ts` (a global
 * ambient `.d.ts`). TypeScript's `include` globs (`src/**​/*.ts`) do NOT pull an
 * unreferenced ambient `.d.ts` into the program, so `env.d.ts` is listed in
 * `apps/web/tsconfig.json` under `"files"`. If that entry is ever removed, the
 * augmentation silently stops loading and `Astro.locals.locale` / `.user` /
 * `.cspNonce` revert to errors across ~117 sites — exactly the failure SPEC-218
 * fixed.
 *
 * This guard reads each augmented field, so it FAILS TO COMPILE (and breaks the
 * typecheck gate) the moment the augmentation is no longer loaded. It has no
 * runtime behaviour and is never called — it exists purely as a compile-time
 * assertion.
 */
export const assertAppLocalsAugmented = (locals: App.Locals): void => {
    // If any of these error with "Property '…' does not exist on type 'Locals'",
    // the env.d.ts augmentation is no longer loaded — restore
    // "files": ["src/env.d.ts"] in apps/web/tsconfig.json. See SPEC-218.
    void locals.locale;
    void locals.user;
    void locals.cspNonce;
};
