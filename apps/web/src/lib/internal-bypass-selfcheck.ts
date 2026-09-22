/**
 * @file internal-bypass-selfcheck.ts
 * @description Re-export shim for the HOS-155 internal-bypass self-check.
 *
 * The implementation moved to `@repo/config` in HOS-1153, when the admin
 * acquired the same server-to-server call shape (and therefore the same silent
 * failure mode) and a second copy would have violated the single-source-of-
 * truth rule. Nothing about the web's behaviour changed.
 *
 * This file stays so `src/lib/internal-bypass-report.ts` and
 * `test/lib/internal-bypass-selfcheck.test.ts` keep importing the same path.
 */

export {
    checkInternalBypassConfig,
    type InternalBypassCheckResult
} from '@repo/config';
