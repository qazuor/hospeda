export function Gradient({
    conic,
    className,
    small
}: {
    small?: boolean;
    conic?: boolean;
    className?: string;
}) {
    return (
        <span
            className={`absolute rounded-[100%] mix-blend-normal will-change-[filter] ${
                small ? 'blur-[32px]' : 'blur-[75px]'
            } ${
                conic
                    ? 'bg-[conic-gradient(from_180deg_at_50%_50%,var(--red-1000)_0deg,_var(--purple-1000)_180deg,_var(--blue-1000)_360deg)]'
                    : ''
            } ${className ?? ''}`}
        />
    );
}
