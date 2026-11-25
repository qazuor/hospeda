import { useEffect, useState } from 'react';
import { fetchAuthMe, readCachedAuthMe, writeCachedAuthMe } from '@/lib/auth-cache';

/** Account details used by public forms without personalizing cached page HTML. */
export interface PublicFormVisitor {
    readonly name: string | null;
    readonly email: string | null;
}

/** Resolves the public form visitor in the browser using the shared session cache. */
export function usePublicFormVisitor({
    currentUser = null
}: {
    readonly currentUser?: PublicFormVisitor | null;
} = {}) {
    const [visitor, setVisitor] = useState<PublicFormVisitor | null>(currentUser);

    useEffect(() => {
        if (currentUser !== null) return;
        let cancelled = false;

        async function resolveVisitor(): Promise<void> {
            const cached = readCachedAuthMe();
            const snapshot = cached ?? (await fetchAuthMe());
            if (cancelled) return;
            if (!cached) writeCachedAuthMe(snapshot);
            if (snapshot.isAuthenticated && snapshot.user) {
                setVisitor(snapshot.user);
            }
        }

        void resolveVisitor().catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [currentUser]);

    return { visitor, accountEmail: visitor?.email?.trim() ?? '' };
}
