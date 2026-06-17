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
    await saveMeasurement(platform, userId, systolic, diastolic, pulse);

    return {
        systolic,
        diastolic,
        pulse,
        message: `Сохранено:\n` +
            `Систола: ${systolic}\n` +
            `Диастола: ${diastolic}\n` +
            `Пульс: ${pulse}`
    };
}