import {prisma} from "../services/database/db";

/**
 * Пульсовое давление (ПД)
 * Формула: САД - ДАД
 * Норма: 30–50 мм рт.ст.
 */
export function calculatePd(systolic: number, diastolic: number): number {
    return systolic - diastolic;
}

/**
 * Тройное произведение (ТП)
 * Формула: (САД × ДАД × Пульс) / 1000
 * Чем выше, тем выше потребность миокарда в кислороде (риск ишемии)
 */
export function calculateTp(systolic: number, diastolic: number, pulse: number): number {
    return (systolic * diastolic * pulse) / 1000;
}

/**
 * Среднее артериальное давление (СрАД)
 * Формула: ДАД + (САД - ДАД) / 3
 * Отражает перфузию органов
 */
export function calculateSrad(systolic: number, diastolic: number): number {
    return diastolic + (systolic - diastolic) / 3;
}

/**
 * Индекс Кердо (вегетативный индекс)
 * Формула: (1 - ДАД / Пульс) × 100
 * <0 — симпатикотония (риск гипертонии/тахи)
 */
export function calculateKerdo(diastolic: number, pulse: number): number {
    if (pulse === 0) return 0;
    return (1 - diastolic / pulse) * 100;
}

export function determineRiskZone(s: number, d: number, pd: number, tp: number, srad: number) {
    if (tp > 350 || pd > 60) return { message: 'КРАСНЫЙ: высокий риск инфаркта. Нужен врач!', color: 'red' };
    if (s > 135 || d > 85) return { message: 'Желтый: нагрузка на сосуды', color: 'yellow' };
    if (srad < 70 && pd < 25) return { message: 'Риск гипотонии / слабости', color: 'blue' };
    if (s >= 110 && s <= 120 && d >= 70 && d <= 80 && tp < 200) {
        return { message: 'Зеленый: сердце работает экономно', color: 'green' };
    }
    return { message: 'Показатели в пределах нормы, но есть небольшие отклонения', color: 'green' };
}
export async function checkAlert(
    userId: number,
    systolic: number,
    diastolic: number,
    userSettings?: { targetSystolic?: number | null; targetDiastolic?: number | null; notifyOnHigh?: boolean; medication?: string | null }
): Promise<string | null> {
    if (userSettings?.notifyOnHigh === false) return null;

    let avgSys = userSettings?.targetSystolic ?? 0;
    let avgDia = userSettings?.targetDiastolic ?? 0;
    if (!avgSys || !avgDia) {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const measures = await prisma.measurement.findMany({
            where: { userId, createdAt: { gte: weekAgo } },
            orderBy: { createdAt: 'desc' }
        });
        if (measures.length < 3) return null;
        avgSys = measures.reduce((s, m) => s + m.systolic, 0) / measures.length;
        avgDia = measures.reduce((s, m) => s + m.diastolic, 0) / measures.length;
    }

    const isHigh = (systolic > 140 || diastolic > 90) ||
        (systolic > avgSys * 1.15 || diastolic > avgDia * 1.15);
    if (!isHigh) return null;

    const recent = await prisma.measurement.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3
    });
    if (recent.length < 3) return null;
    let decreasing = true;
    for (let i = 0; i < recent.length - 1; i++) {
        if (recent[i].systolic <= recent[i + 1].systolic) {
            decreasing = false;
            break;
        }
    }
    if (decreasing) return null;

    const med = userSettings?.medication || 'препарат';
    return `Давление выше вашей нормы (обычно ${avgSys.toFixed(0)}/${avgDia.toFixed(0)}). Тенденции к спаду нет. Напоминание: принять ${med}?`;
}