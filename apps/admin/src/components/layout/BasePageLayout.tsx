import type { ReactNode } from 'react';
import { Breadcrumbs } from './Breadcrumbs';

export type BasePageLayoutProps = {
    readonly title: string;
    readonly actions?: ReactNode;
    readonly children: ReactNode;
    readonly class?: string;
};

export const BasePageLayout = ({
    title,
    actions,
    children,
    class: className
}: BasePageLayoutProps) => {
    return (
        <section className={`space-y-4 p-6${className ? ` ${className}` : ''}`}>
            <header className="flex items-center justify-between">
                <h1 className="font-semibold text-2xl">{title}</h1>
                <div className="flex items-center gap-2">{actions}</div>
            </header>
            <Breadcrumbs />
            <div className="pt-2">{children}</div>
        </section>
    );
};
