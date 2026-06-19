import { parseThreeNumbers } from './parsers';
import { saveMeasurement } from '../services/database/measurementService';

export async function handleMeasurement(
    platform: 'telegram' | 'max',
    userId: string | number | bigint,
    text: string
) {
    const parsed = parseThreeNumbers(text);
    if (!parsed) return null;

    const { systolic, diastolic, pulse } = parsed;

    const result = await saveMeasurement(platform, userId, systolic, diastolic, pulse);

    let reply = `Давление: ${systolic}/${diastolic}, пульс: ${pulse}\n`;
    reply += `ПД: ${result.indices.pd} | `;
    reply += `ТП: ${result.indices.tp.toFixed(2)} | `;
    reply += `СрАД: ${result.indices.srad.toFixed(1)} | `;
    reply += `Кердо: ${result.indices.kerdo.toFixed(1)}\n`;

    return {
        systolic,
        diastolic,
        pulse,
        indices: result.indices,
        message: reply
    };
}