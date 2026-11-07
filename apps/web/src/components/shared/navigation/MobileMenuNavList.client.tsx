import type { MouseEventHandler } from 'react';
import styles from './MobileMenu.module.css';

interface NavItem {
    readonly label: string;
    readonly href: string;
    readonly children?: readonly { readonly label: string; readonly href: string }[];
}

interface Props {
    readonly navItems: readonly NavItem[];
    readonly isOpen: boolean;
    readonly onLinkClick: MouseEventHandler<HTMLAnchorElement>;
}

/** Renders the server-provided primary navigation and its nested links. */
export function MobileMenuNavList({ navItems, isOpen, onLinkClick }: Props) {
    return (
        <ul className={styles.navList}>
            {navItems.map((item) => (
                <li key={item.href}>
                    <a
                        href={item.href}
                        onClick={onLinkClick}
                        tabIndex={isOpen ? 0 : -1}
                        className={styles.navLink}
                    >
                        {item.label}
                    </a>
                    {item.children && item.children.length > 0 && (
                        <ul className={styles.navSubList}>
                            {item.children.map((child) => (
                                <li key={child.href}>
                                    <a
                                        href={child.href}
                                        onClick={onLinkClick}
                                        tabIndex={isOpen ? 0 : -1}
                                        className={styles.navSubLink}
                                    >
                                        {child.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                </li>
            ))}
        </ul>
    );
}
