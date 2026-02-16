import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { buildUrl } from '../../lib/urls';

/**
 * Navigation item for mobile menu
 */
export interface NavItem {
    readonly label: string;
    readonly href: string;
}

/**
 * Props for the MobileMenu component
 */
export interface MobileMenuProps {
    readonly navItems: ReadonlyArray<NavItem>;
    readonly locale?: 'es' | 'en';
    readonly user?: { readonly name: string; readonly email: string } | null;
    readonly open: boolean;
    readonly onClose: () => void;
    readonly className?: string;
}

/**
 * Mobile navigation menu component with slide-in animation
 *
 * Uses native `<dialog>` element for accessibility:
 * - Focus trap
 * - Escape key handling
 * - Screen reader support
 *
 * Features:
 * - Slides in from the right side
 * - Navigation links list
 * - Authentication section (conditional based on user prop)
 * - Locale-aware strings
 *
 * @param props - MobileMenuProps
 * @returns Mobile menu dialog component
 *
 * @example
 * ```tsx
 * <MobileMenu
 *   navItems={[
 *     { label: 'Home', href: '/' },
 *     { label: 'About', href: '/about' }
 *   ]}
 *   locale="es"
 *   user={{ name: 'John Doe', email: 'john@example.com' }}
 *   open={isMenuOpen}
 *   onClose={() => setIsMenuOpen(false)}
 * />
 * ```
 */
export function MobileMenu({
    navItems,
    locale = 'es',
    user = null,
    open,
    onClose,
    className = ''
}: MobileMenuProps): ReactElement {
    const dialogRef = useRef<HTMLDialogElement>(null);

    // Handle open/close state
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (open && !dialog.open) {
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    // Handle cancel event (Escape key)
    const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
        event.preventDefault();
        onClose();
    };

    // Auth strings based on locale
    const authStrings = {
        es: {
            signIn: 'Iniciar sesion',
            signUp: 'Registrarse'
        },
        en: {
            signIn: 'Sign in',
            signUp: 'Sign up'
        }
    };

    const strings = authStrings[locale];

    return (
        <dialog
            ref={dialogRef}
            onCancel={handleCancel}
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
            className={`fixed top-0 right-0 m-0 h-screen w-80 max-w-[85vw] translate-x-full border-border border-l bg-bg p-0 shadow-2xl transition-transform duration-300 ease-in-out backdrop:bg-black/50 backdrop:backdrop-blur-sm open:translate-x-0 ${className}`.trim()}
        >
            <div className="flex h-full flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-border border-b p-4">
                    <h2
                        id="mobile-menu-title"
                        className="font-semibold text-lg"
                    >
                        Menu
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close mobile menu"
                        className="rounded-md p-2 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        <svg
                            aria-hidden="true"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <title>Close icon</title>
                            <line
                                x1="18"
                                y1="6"
                                x2="6"
                                y2="18"
                            />
                            <line
                                x1="6"
                                y1="6"
                                x2="18"
                                y2="18"
                            />
                        </svg>
                    </button>
                </div>

                {/* Navigation Links */}
                <nav
                    className="flex-grow overflow-y-auto p-4"
                    aria-label="Mobile navigation"
                >
                    <ul className="space-y-2">
                        {navItems.map((item) => (
                            <li key={item.href}>
                                <a
                                    href={item.href}
                                    className="block rounded-md px-4 py-3 text-text transition-colors hover:bg-bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                                >
                                    {item.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Auth Section */}
                <div className="border-border border-t p-4">
                    {user ? (
                        <div className="space-y-1">
                            <p className="font-medium text-sm text-text">{user.name}</p>
                            <p className="text-sm text-text-secondary">{user.email}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <a
                                href={buildUrl({ locale, path: 'auth/signin' })}
                                className="block rounded-md bg-bg-secondary px-4 py-2 text-center text-text transition-colors hover:bg-bg-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            >
                                {strings.signIn}
                            </a>
                            <a
                                href={buildUrl({ locale, path: 'auth/signup' })}
                                className="block rounded-md bg-primary px-4 py-2 text-center text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            >
                                {strings.signUp}
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </dialog>
    );
}
