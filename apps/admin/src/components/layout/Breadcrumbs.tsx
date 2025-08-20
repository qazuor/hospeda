import { menuTree } from '@/lib/menu';
import { BreadcrumbsIcon } from '@repo/icons';
import { Link, useRouterState } from '@tanstack/react-router';

const getLabelForPath = (path: string): string => {
    for (const item of menuTree) {
        if (item.to === path && item.title) return item.title;
        if (item.children) {
            for (const child of item.children) {
                if (child.to === path && child.title) return child.title;
            }
        }
    }
    const seg = path.split('/').filter(Boolean).pop() ?? '';
    return seg.charAt(0).toUpperCase() + seg.slice(1);
};

export const Breadcrumbs = () => {
    const { location } = useRouterState();
    const segments = location.href.split('/').filter(Boolean);
    const paths: string[] = [];
    segments.forEach((_, idx) => {
        paths.push(`/${segments.slice(0, idx + 1).join('/')}`);
    });

    return (
        <nav
            aria-label="Breadcrumb"
            className="flex items-center text-muted-foreground text-sm"
        >
            <Link
                to="/dashboard"
                className="hover:underline"
            >
                Home
            </Link>
            {paths.map((p) => (
                <span
                    key={p}
                    className="inline-flex items-center"
                >
                    <BreadcrumbsIcon className="mx-2 h-4 w-4" />
                    <Link
                        to={p}
                        className="hover:underline"
                    >
                        {getLabelForPath(p)}
                    </Link>
                </span>
            ))}
        </nav>
    );
};
