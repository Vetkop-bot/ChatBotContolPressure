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

/**
 * Утилита: возвращает все расчёты одним объектом
 */
export function calculateAll(
    systolic: number,
    diastolic: number,
    pulse: number
): {
    pd: number;
    tp: number;
    srad: number;
    kerdo: number;
} {
    return {
        pd: calculatePd(systolic, diastolic),
        tp: calculateTp(systolic, diastolic, pulse),
        srad: calculateSrad(systolic, diastolic),
        kerdo: calculateKerdo(diastolic, pulse),
    };
}