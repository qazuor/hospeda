import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ExternalLink, RotateCcw } from 'lucide-react';

interface ThankYouMessageProps {
    issueUrl: string;
    identifier: string;
    onReportAnother: () => void;
}

/**
 * Success message displayed after a bug report is submitted.
 * Shows the Linear issue link and a button to submit another report.
 */
export function ThankYouMessage({ issueUrl, identifier, onReportAnother }: ThankYouMessageProps) {
    return (
        <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
                <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="rounded-full bg-green-100 p-3">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>

                    <div>
                        <h2 className="font-semibold text-green-900 text-xl">
                            Gracias por tu reporte
                        </h2>
                        <p className="mt-1 text-green-700">
                            Tu reporte fue enviado exitosamente como{' '}
                            <span className="font-medium font-mono">{identifier}</span>.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                        <a
                            href={issueUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-green-700 text-sm underline underline-offset-2 hover:text-green-900"
                        >
                            Ver en Linear
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onReportAnother}
                            className="gap-2"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reportar otro bug
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
