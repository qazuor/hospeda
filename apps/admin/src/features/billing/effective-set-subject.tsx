import type { VerticalEnum } from '@repo/schemas';
import { createContext, type ReactNode, useContext } from 'react';

/** HOS-1638 AC:B13a:23: the owner and vertical whose effective set the screen shows. */
export interface EffectiveSetSubject {
    readonly userId: string;
    readonly vertical: VerticalEnum;
}

const EffectiveSetSubjectContext = createContext<EffectiveSetSubject | null>(null);

/** HOS-1638 AC:B13a:23: binds a listing screen to its owner's V3 set. */
export function EffectiveSetSubjectProvider({
    value,
    children
}: {
    readonly value: EffectiveSetSubject | null;
    readonly children: ReactNode;
}): ReactNode {
    return (
        <EffectiveSetSubjectContext.Provider value={value}>
            {children}
        </EffectiveSetSubjectContext.Provider>
    );
}

/** HOS-1638 AC:B13a:23: null means this staff screen has no listing subject. */
export function useEffectiveSetSubject(): EffectiveSetSubject | null {
    return useContext(EffectiveSetSubjectContext);
}
