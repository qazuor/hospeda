import { getLoggerConfigs } from '@repo/config/client';
import { configureLogger, logger } from '@repo/logger';
import { useState } from 'react';
import AccommodationCard from './AccommodationCard';
import './App.css';
import viteLogo from '/vite.svg';
import reactLogo from './assets/react.svg';

configureLogger(getLoggerConfigs());

function App() {
    logger.log('Rendering the main page (log)');
    logger.info('Rendering the main page (info)');
    // logger.warn('Rendering the main page (warn)');
    // logger.error('Rendering the main page (error)');
    // logger.debug('Rendering the main page (debug)');

    const [count, setCount] = useState(0);

    return (
        <>
            <div>
                <a
                    href="https://vite.dev"
                    target="_blank"
                    rel="noreferrer"
                >
                    <img
                        src={viteLogo}
                        className="logo"
                        alt="Vite logo"
                    />
                </a>
                <a
                    href="https://react.dev"
                    target="_blank"
                    rel="noreferrer"
                >
                    <img
                        src={reactLogo}
                        className="logo react"
                        alt="React logo"
                    />
                </a>
            </div>
            <h1>Vite + React</h1>
            <div className="card">
                <button
                    type="button"
                    onClick={() => setCount((count) => count + 1)}
                >
                    count is {count}
                </button>
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <AccommodationCard apiUrl={'http://localhost:8080/api/v1'} />
            <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
        </>
    );
}

export default App;
