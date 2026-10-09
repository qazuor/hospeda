import type { VerticalEnum } from '@repo/schemas';
import type { EffectiveSetPort } from './entitlement-step';

/** Step 7 rejects requests above the subject's effective limit. */
export async function resolveLimitStep(args: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly limit: { readonly key: string; readonly requested: number };
    readonly effectiveSet: EffectiveSetPort;
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
    const max =
        effective.limits.get({
            key: args.limit.key,
            userId: args.userId,
            vertical: args.vertical
        }) ?? 0;
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
