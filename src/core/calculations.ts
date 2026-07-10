import {prisma} from "../services/database/db";

export function calculatePd(systolic: number, diastolic: number): number {
    return systolic - diastolic;
}
export function calculateTp(systolic: number, diastolic: number, pulse: number): number {
    return (systolic * pulse) / 100;
}
export function calculateSrad(systolic: number, diastolic: number): number {
    return diastolic + (systolic - diastolic) / 3;
}
export function calculateKerdo(diastolic: number, pulse: number): number {
    if (pulse === 0) return 0;
    return (diastolic / pulse) * 100;
}

export function determineRiskZone(s: number, d: number, pd: number, tp: number, srad: number) {
    if (s >= 180 || d >= 110) {
        return { message: 'КРАСНЫЙ: гипертонический криз. Немедленно вызывайте скорую!', color: 'red' };
    }

    if (tp > 350 || pd > 60) {
        return { message: 'КРАСНЫЙ: высокий риск инфаркта. Нужен врач!', color: 'red' };
    }

    if (s >= 140 || d >= 90) {
        return { message: 'ОРАНЖЕВЫЙ: повышенное давление. Примите препарат и отдохните.', color: 'orange' };
    }

    if (s > 130 || d > 85) {
        return { message: 'Жёлтый: нагрузка на сосуды. Отдохните и повторите замер.', color: 'yellow' };
    }

    if (s < 90 || d < 60 || (srad < 70 && pd < 25)) {
        return { message: 'Синий: низкое давление. Выпейте кофе или сладкий чай.', color: 'blue' };
    }

    if (s >= 100 && s <= 130 && d >= 60 && d <= 85 && tp >= 150 && tp <= 300) {
        return { message: 'Зелёный: давление в норме, сердце работает хорошо.', color: 'green' };
    }

    return { message: 'Зелёный: показатели в пределах нормы.', color: 'green' };
}

export async function checkAlert(
    userId: number,
    systolic: number,
    diastolic: number,
    userSettings?: { targetSystolic?: number | null; targetDiastolic?: number | null; notifyOnHigh?: boolean; medication?: string | null } | null
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