import type { Vertical } from '@repo/schemas';

/**
 * The trial machine lock key (FILA:V4 point 6), shared with T1 and future PB1
 * (V6.1). The `trial-start:` prefix preserves serialization with T1.
 */
export function trialMachineLockKey(args: {
    readonly userId: string;
    readonly vertical: Vertical;
}): { readonly key: string } {
    return { key: `trial-start:${args.userId}:${args.vertical}` };
}
