import {
    type ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export type Toast = {
    readonly id: string;
    readonly title?: string;
    readonly message: string;
    readonly variant?: ToastVariant;
    readonly durationMs?: number;
};

export type ToastContextValue = {
    readonly addToast: (toast: Omit<Toast, 'id'>) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};

export type ToastProviderProps = {
    readonly children: ReactNode;
};

export const ToastProvider = ({ children }: ToastProviderProps) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timeouts = useRef<Record<string, number>>({});

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const tid = timeouts.current[id];
        if (tid) {
            clearTimeout(tid);
            delete timeouts.current[id];
        }
    }, []);

    const addToast = useCallback(
        (toast: Omit<Toast, 'id'>) => {
            const id = crypto.randomUUID();
            const next: Toast = {
                id,
                variant: 'default',
                durationMs: 15000,
                ...toast
            };
            setToasts((prev) => [...prev, next]);
            const tid = window.setTimeout(() => removeToast(id), next.durationMs);
            timeouts.current[id] = tid;
        },
        [removeToast]
    );

    useEffect(() => {
        return () => {
            for (const tid of Object.values(timeouts.current)) {
                clearTimeout(tid);
            }
            timeouts.current = {};
        };
    }, []);

    const value = useMemo<ToastContextValue>(() => ({ addToast }), [addToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Toast viewport */}
            <div className="pointer-events-none fixed top-3 right-3 z-[9999] flex w-[min(92vw,24rem)] flex-col gap-2">
                {toasts.map((t) => (
                    <output
                        key={t.id}
                        className={`pointer-events-auto rounded-md border px-3 py-2 shadow-md ${
                            t.variant === 'error'
                                ? 'border-red-500 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100'
                                : t.variant === 'success'
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100'
                                  : t.variant === 'warning'
                                    ? 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100'
                                    : t.variant === 'info'
                                      ? 'border-sky-500 bg-sky-50 text-sky-900 dark:border-sky-400 dark:bg-sky-950 dark:text-sky-100'
                                      : 'border-border bg-card text-card-foreground'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                {t.title ? (
                                    <div className="mb-0.5 font-semibold text-sm">{t.title}</div>
                                ) : null}
                                <div className="text-sm">{t.message}</div>
                            </div>
                            <button
                                type="button"
                                aria-label="Close toast"
                                className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-xs hover:bg-accent"
                                onClick={() => removeToast(t.id)}
                            >
                                ×
                            </button>
                        </div>
                    </output>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
