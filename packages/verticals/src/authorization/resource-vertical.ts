export function resolveResourceVertical(args: {
    readonly resourceVertical: string;
    readonly declaredVertical?: string | null;
}):
    | { readonly allowed: true; readonly vertical: string }
    | { readonly allowed: false; readonly reason: 'NOT_FOUND' } {
    if (args.declaredVertical != null && args.declaredVertical !== args.resourceVertical) {
        return { allowed: false, reason: 'NOT_FOUND' };
    }
    return { allowed: true, vertical: args.resourceVertical };
}
