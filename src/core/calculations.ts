
/**
 * Пульсовое давление (ПД)
 * Норма: 30–50 мм рт.ст.
 */
export function calculatePd(systolic: number, diastolic: number): number {
    return systolic - diastolic;
}

/**
 * Тройное произведение (ТП)
 * Отражает потребность миокарда в кислороде
 */
export function calculateTp(systolic: number, diastolic: number, pulse: number): number {
    return (systolic * diastolic * pulse) / 1000;
}

/**
 * Среднее артериальное давление (СрАД)
 * Отражает перфузию органов
 */
export function calculateSrad(systolic: number, diastolic: number): number {
    return diastolic + (systolic - diastolic) / 3;
}

/**
 * Индекс Кердо (вегетативный индекс)
 * 0 — симпатикотония (риск гипертонии/тахи)
 */
export function calculateKerdo(diastolic: number, pulse: number): number {
    if (pulse === 0) return 0;
    return (1 - diastolic / pulse) * 100;
}

/**
 * Определение зоны риска на основе показателей
 * Возвращает строку с названием зоны
 */
export function determineRiskZone(
    systolic: number,
    diastolic: number,
    pulse: number,
    pd: number,
    tp: number,
    srad: number,
    kerdo: number
): string {
    let risk = 'Низкая';

    if (systolic >= 180 || diastolic >= 120) {
        risk = 'Очень высокая (гипертонический криз)';
    } else if (systolic >= 160 || diastolic >= 100) {
        risk = 'Высокая (II степень гипертонии)';
    } else if (systolic >= 140 || diastolic >= 90) {
        risk = 'Средняя (I степень гипертонии)';
    } else if (systolic >= 130 || diastolic >= 85) {
        risk = 'Повышенная (высокое нормальное)';
    }


    if (pd < 30 || pd > 50) {
        risk += ', ПД вне нормы';
    }
    if (tp > 30) {
        risk += ', высокое ТП (риск ишемии)';
    }
    if (kerdo < 0) {
        risk += ', симпатикотония';
    }

    return risk;
}

/**
 * Проверка на превышение личной нормы и тенденцию к снижению
 * Возвращает сообщение-напоминание или null
 */
export async function checkAlert(
    userId: number,
    systolic: number,
    diastolic: number,
    prisma: any // передаём экземпляр PrismaClient
): Promise<string | null> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const measures = await prisma.measurement.findMany({
        where: {
            userId,
            createdAt: { gte: weekAgo }
        },
        orderBy: { createdAt: 'desc' }
    });

    if (measures.length < 3) return null;

    const avgSys = measures.reduce((s: any, m: { systolic: any; }) => s + m.systolic, 0) / measures.length;
    const avgDia = measures.reduce((s: any, m: { diastolic: any; }) => s + m.diastolic, 0) / measures.length;

     const isHigh = (systolic > 140 || diastolic > 90) ||
        (systolic > avgSys * 1.15 || diastolic > avgDia * 1.15);

    if (!isHigh) return null;

    const lastThree = measures.slice(0, 3);
    let decreasing = true;
    for (let i = 0; i < lastThree.length - 1; i++) {
        if (lastThree[i].systolic <= lastThree[i + 1].systolic) {
            decreasing = false;
            break;
        }
    }
    if (decreasing) return null;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const med = user?.medication || 'препарат';

    return ` Давление выше вашей нормы (обычно ${avgSys.toFixed(0)}/${avgDia.toFixed(0)}). Тенденции к спаду нет. Напоминание: принять ${med}?`;
}