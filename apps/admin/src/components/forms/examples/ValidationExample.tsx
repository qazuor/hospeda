/**
 * Main validation examples component
 *
 * Orchestrates and displays the three example validation forms
 * with a tabbed interface and features overview.
 */
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type React from 'react';
import { useState } from 'react';

import {
    ConditionalFieldsExample,
    DateRangeExample,
    UserRegistrationExample
} from './validation-example-forms';

export const ValidationExample: React.FC = () => {
    const [activeExample, setActiveExample] = useState<
        'registration' | 'dateRange' | 'conditional'
    >('registration');

    return (
        <div className="space-y-6">
            {/* Example selector */}
            <div className="flex space-x-2">
                <Button
                    variant={activeExample === 'registration' ? 'default' : 'outline'}
                    onClick={() => setActiveExample('registration')}
                >
                    User Registration
                </Button>
                <Button
                    variant={activeExample === 'dateRange' ? 'default' : 'outline'}
                    onClick={() => setActiveExample('dateRange')}
                >
                    Date Range
                </Button>
                <Button
                    variant={activeExample === 'conditional' ? 'default' : 'outline'}
                    onClick={() => setActiveExample('conditional')}
                >
                    Conditional Fields
                </Button>
            </div>

            {/* Active example */}
            {activeExample === 'registration' && <UserRegistrationExample />}
            {activeExample === 'dateRange' && <DateRangeExample />}
            {activeExample === 'conditional' && <ConditionalFieldsExample />}

            {/* Features overview */}
            <Card>
                <CardHeader>
                    <CardTitle>Form Validation Features</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <h4 className="font-medium text-foreground">Async Validation</h4>
                            <ul className="mt-2 space-y-1 text-muted-foreground text-sm">
                                <li>Email uniqueness checking</li>
                                <li>Username availability</li>
                                <li>Real-time API validation</li>
                                <li>Debounced requests</li>
                                <li>Caching and retry logic</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-medium text-foreground">Cross-Field Validation</h4>
                            <ul className="mt-2 space-y-1 text-muted-foreground text-sm">
                                <li>Password confirmation</li>
                                <li>Date range validation</li>
                                <li>Conditional required fields</li>
                                <li>Age verification</li>
                                <li>Numeric range checking</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-medium text-foreground">User Experience</h4>
                            <ul className="mt-2 space-y-1 text-muted-foreground text-sm">
                                <li>Real-time feedback</li>
                                <li>Loading indicators</li>
                                <li>Success/error states</li>
                                <li>Accessibility support</li>
                                <li>Mobile-friendly design</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-medium text-foreground">Developer Features</h4>
                            <ul className="mt-2 space-y-1 text-muted-foreground text-sm">
                                <li>TypeScript support</li>
                                <li>Reusable validators</li>
                                <li>Configurable rules</li>
                                <li>Error handling</li>
                                <li>Performance optimized</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
