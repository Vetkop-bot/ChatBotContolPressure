import { parseThreeNumbers } from './parsers';
import { saveMeasurement } from '../services/database/measurementService';
import { prisma } from '../services/database/db';
import { determineRiskZone } from './calculations';

export async function handleMeasurement(
    platform: 'telegram' | 'max',
    userId: string | number | bigint,
    text: string
) {
    const parsed = parseThreeNumbers(text);
    if (!parsed) return null;

    const { systolic, diastolic, pulse } = parsed;

    const result = await saveMeasurement(platform, userId, systolic, diastolic, pulse);

    const where = platform === 'telegram'
        ? { telegramId: userId as number | bigint }
        : { maxUserId: userId as string };

    const user = await prisma.user.findUnique({ where });

    let prev = null;
    if (user) {
        prev = await prisma.measurement.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            skip: 1
        });
    }

    const risk = determineRiskZone(
        systolic,
        diastolic,
        result.indices.pd,
        result.indices.tp,
        result.indices.srad
    );

    let reply = ` Давление: ${systolic}/${diastolic}, пульс: ${pulse}\n`;
    reply += `Пульсовое давление: ${result.indices.pd}\n`;
    reply += `Тройное произведение: ${result.indices.tp.toFixed(2)}\n`;
    reply += `Среднее артериальное давление: ${result.indices.srad.toFixed(1)}\n`;
    reply += `Индекс Кердо: ${result.indices.kerdo.toFixed(1)}\n`;
    reply += `Зона риска: ${risk.message}\n`;

    if (prev) {
        const diffSys = systolic - prev.systolic;
        const diffDia = diastolic - prev.diastolic;
        const diffPulse = pulse - prev.pulse;
        const changes = [];
        if (diffSys > 0) changes.push(`систола выросла на ${diffSys}`);
        else if (diffSys < 0) changes.push(`систола упала на ${Math.abs(diffSys)}`);
        else changes.push('систола без изменений');
        if (diffDia > 0) changes.push(`диастола выросла на ${diffDia}`);
        else if (diffDia < 0) changes.push(`диастола упала на ${Math.abs(diffDia)}`);
        else changes.push('диастола без изменений');
        if (diffPulse > 0) changes.push(`пульс вырос на ${diffPulse}`);
        else if (diffPulse < 0) changes.push(`пульс упал на ${Math.abs(diffPulse)}`);
        else changes.push('пульс без изменений');
        reply += `\nСравниваю с вашим предыдущим замером (${prev.systolic}/${prev.diastolic}, пульс ${prev.pulse}): ${changes.join(', ')}.\n`;
    } else {
        reply += `\nЭто ваше первое измерение. Начните отслеживать динамику!\n`;
    }

    if (result.alert) {
        reply += `\n${result.alert}`;
        if (risk.color === 'red') {
            reply += ` Если не станет лучше через 30 минут — вызывайте скорую.`;
        }
    }
    if (risk.color === 'red' && !result.alert) {
        const med = user?.medication || 'препарат';
        reply += `\nВы в КРАСНОЙ зоне. Рекомендуем принять ${med} (согласно вашим настройкам) и вызвать врача, если не станет лучше.`;
    }

    return {
        systolic,
        diastolic,
        pulse,
        indices: result.indices,
        message: reply,
        alert: result.alert
    };
}