import logger from '@repo/logger';
import type { AccommodationType } from '@repo/types';
import { type JSX, useEffect, useState } from 'react';
interface AccommodationCardProps {
    apiUrl: string;
}

export default function AccommodationCard({ apiUrl }: AccommodationCardProps): JSX.Element {
    const [accommodations, setAccommodations] = useState<AccommodationType[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const fetchAccommodations = async () => {
            try {
                logger.info(`API URL: ${apiUrl}`);
                const response = await fetch(`${apiUrl}/accommodations`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const data = await response.json();
                if (!data.ok) {
                    setAccommodations(data.data);
                }
            } catch (error) {
                logger.error(`Error fetching data: ${error}`);
                throw error;
            } finally {
                setLoading(false);
            }
        };
        fetchAccommodations();
    }, [apiUrl]);

    return (
        <div className="text-center">
            <span className="font-bold font-mono">Accommodations</span>
            <div className="font-bold font-mono">
                {loading ? (
                    <span>Loading...</span>
                ) : accommodations.length > 0 ? (
                    accommodations.map((accommodation: AccommodationType) => (
                        <div
                            className="m-2 rounded border border-1 border-gray-300 p-4"
                            key={accommodation.id}
                        >
                            <div>
                                {accommodation.displayName} ({accommodation.name})
                            </div>
                            <div>{accommodation.description}</div>
                            <div>{accommodation.ownerId}</div>
                            <div>
                                <strong>Contecto info:</strong>
                                <div>
                                    <strong>Phone:</strong> {accommodation.contactInfo?.homePhone}
                                </div>
                                <div>
                                    <strong>Email:</strong>{' '}
                                    {accommodation.contactInfo?.personalEmail}
                                </div>
                                <div>
                                    <strong>Facebook:</strong>{' '}
                                    {accommodation.socialNetworks?.facebook}
                                </div>
                                <div>
                                    <strong>Instagram:</strong>{' '}
                                    {accommodation.socialNetworks?.instagram}
                                </div>
                                <div>
                                    <strong>Twitter:</strong>{' '}
                                    {accommodation.socialNetworks?.twitter}
                                </div>
                            </div>
                            <div>
                                <strong>Lat:</strong> {accommodation.location?.coordinates?.lat},{' '}
                                <strong>Long:</strong> {accommodation.location?.coordinates?.long}
                            </div>
                            <div>
                                <div>
                                    <strong>Price:</strong>{' '}
                                    <div>
                                        <strong>Additional Fees:</strong>
                                        <div>
                                            <strong>Cleaning:</strong>{' '}
                                        </div>
                                        <div>
                                            <strong>Service:</strong>{' '}
                                        </div>
                                        <div>
                                            <strong>Tax Percentage:</strong>{' '}
                                        </div>
                                    </div>
                                    <div>
                                        <strong>Discounts:</strong>
                                        <div>
                                            <strong>Last Minute:</strong>{' '}
                                        </div>
                                        <div>
                                            <strong>Monthly:</strong>{' '}
                                        </div>
                                        <div>
                                            <strong>Weekly:</strong>{' '}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <span>No accommodations found</span>
                )}
            </div>
        </div>
    );
}
