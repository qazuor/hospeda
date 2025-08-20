import { Link } from '@tanstack/react-router';

import ClerkHeader from '../integrations/clerk/header-user.tsx';

export default function Header() {
    return (
        <header className="flex justify-between gap-2 bg-white p-2 text-black">
            <nav className="flex flex-row">
                <div className="px-2 font-bold">
                    <Link to="/">Home</Link>
                </div>
                <div className="px-2 font-bold">
                    <Link to="/dashboard">Dashboard</Link>
                </div>

                <div className="px-2 font-bold">
                    <Link
                        to="/destinations"
                        search={{
                            page: 1,
                            pageSize: 10,
                            view: 'table',
                            q: '',
                            sort: undefined,
                            cols: undefined
                        }}
                    >
                        Destinations
                    </Link>
                </div>

                <div className="px-2 font-bold">
                    <Link to="/accommodations">Accommodations</Link>
                </div>
            </nav>

            <div>
                <ClerkHeader />
            </div>
        </header>
    );
}
