import logger from '@repo/logger';
import type { Accommodation } from '@repo/types';
import { type JSX, useEffect, useState } from 'react';
interface AccommodationCardProps {
    apiUrl: string;
}

export default function AccommodationCard({ apiUrl }: AccommodationCardProps): JSX.Element {
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
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
                    accommodations.map((accommodation: Accommodation) => (
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
                                    <strong>Phone:</strong> {accommodation.contactInfo?.phone}
                                </div>
                                <div>
                                    <strong>Email:</strong> {accommodation.contactInfo?.email}
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
                                <strong>Lat:</strong> {accommodation.location?.latitude},{' '}
                                <strong>Long:</strong> {accommodation.location?.longitude}
                            </div>
                            <div>
                                <div>
                                    <strong>Price:</strong> {accommodation.price?.currency}{' '}
                                    {accommodation.price?.basePrice}
                                    <div>
                                        <strong>Additional Fees:</strong>
                                        <div>
                                            <strong>Cleaning:</strong>{' '}
                                            {accommodation.price?.additionalFees?.cleaning}
                                        </div>
                                        <div>
                                            <strong>Service:</strong>{' '}
                                            {accommodation.price?.additionalFees?.service}
                                        </div>
                                        <div>
                                            <strong>Tax Percentage:</strong>{' '}
                                            {accommodation.price?.additionalFees?.taxPercentage}
                                        </div>
                                    </div>
                                    <div>
                                        <strong>Discounts:</strong>
                                        <div>
                                            <strong>Last Minute:</strong>{' '}
                                            {accommodation.price?.discounts?.lastMinute}%
                                        </div>
                                        <div>
                                            <strong>Monthly:</strong>{' '}
                                            {accommodation.price?.discounts?.monthly}%
                                        </div>
                                        <div>
                                            <strong>Weekly:</strong>{' '}
                                            {accommodation.price?.discounts?.weekly}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <strong>Amenities</strong> {accommodation.amenities.join(', ')}
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
