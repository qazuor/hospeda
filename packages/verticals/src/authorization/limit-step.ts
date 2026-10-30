import type { VerticalEnum } from '@repo/schemas';
import type { EffectiveSetPort } from './entitlement-step';

/**
 * Step 7 rejects requests above the subject's effective limit.
 *
 * A limit absent from the effective set reads as `0`, unless the caller passes
 * `fallbackMax`: it is asked only for an absent limit, and its answer (when
 * defined) becomes the cap. The resolver passes it solely for the pre-trial
 * DRAFT photo allowance (HOS-1721); a limit the effective set does carry
 * always wins.
 */
export async function resolveLimitStep(args: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly limit: { readonly key: string; readonly requested: number };
    readonly effectiveSet: EffectiveSetPort;
    readonly fallbackMax?: () => Promise<number | undefined>;
}): Promise<
    | { readonly allowed: true }
    | {
          readonly allowed: false;
          readonly reason: 'LIMIT_REACHED';
          readonly key: string;
          readonly max: number;
          readonly requested: number;
      }
> {
    const effective = await args.effectiveSet({ userId: args.userId, vertical: args.vertical });
    const effectiveMax = effective.limits.get({
        key: args.limit.key,
        userId: args.userId,
        vertical: args.vertical
    });
    const max = effectiveMax ?? (args.fallbackMax ? await args.fallbackMax() : undefined) ?? 0;
    return args.limit.requested > max
        ? {
              allowed: false,
              reason: 'LIMIT_REACHED',
              key: args.limit.key,
              max,
              requested: args.limit.requested
          }
        : { allowed: true };
}
