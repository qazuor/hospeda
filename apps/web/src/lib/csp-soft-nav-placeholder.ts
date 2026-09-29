/**
 * @file csp-soft-nav-placeholder.ts
 * @description The substitution token shared by the `csp-soft-nav-hashes`
 * integration (which writes the build-time hash union into the server bundle)
 * and `csp-soft-nav-script-hashes.ts` (which holds the token until then)
 * (HOS-807).
 *
 * Lives in its own dependency-free module because the integration imports it
 * at config time, before Vite exists — importing the runtime module there
 * would evaluate app code outside the bundler.
 *
 * Built by concatenation ON PURPOSE: the full literal must appear exactly ONCE
 * in the server bundle, in `csp-soft-nav-script-hashes.ts`. Were it spelled out
 * here too, the substitution would rewrite both, the runtime's "is it still the
 * placeholder?" check would compare the list with itself, and every production
 * response would ship an empty union. The integration refuses a bundle holding
 * the literal any number of times other than one.
 */
export const SOFT_NAV_SCRIPT_HASHES_PLACEHOLDER = [
    '__HOSPEDA_CSP',
    'SOFT_NAV_SCRIPT_HASHES__'
].join('_');
