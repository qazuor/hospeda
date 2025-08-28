import { ClerkProvider } from '@clerk/tanstack-react-start';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
    throw new Error('Add your Clerk Publishable Key to the .env.local file');
}

export default function AppClerkProvider({
    children
}: {
    children: React.ReactNode;
}) {
    // Only access window on the client side
    const domain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

    return (
        <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            afterSignOutUrl="/"
            // Configure for cross-origin requests
            domain={domain}
            isSatellite={false}
        >
            {children}
        </ClerkProvider>
    );
}
