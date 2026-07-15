export interface ValidationResult {
    sys: number;
    dia: number;
    pulse: number;
    isValid: boolean;
    corrections: string[];
    variants?: Array<{
        sys: number;
        dia: number;
        pulse: number;
        confidence: number;
        changes: string[];
    }>;
}

export function validateAndCorrect(
    data: { sys?: string; dia?: string; pulse?: string }
): ValidationResult {
    const corrections: string[] = [];

    const sys = parseInt(data.sys || '0', 10);
    const dia = parseInt(data.dia || '0', 10);
    const pulse = parseInt(data.pulse || '0', 10);

    // Проверка диапазонов
    if (sys < 70 || sys > 250) {
        corrections.push(`SYS ${sys} вне диапазона 70-250`);
    }
    if (dia < 40 || dia > 160) {
        corrections.push(`DIA ${dia} вне диапазона 40-160`);
    }
    if (pulse < 30 || pulse > 200) {
        corrections.push(`PULSE ${pulse} вне диапазона 30-200`);
    }

    // Проверка логики
    if (sys <= dia) {
        corrections.push(`SYS (${sys}) <= DIA (${dia})`);
    }

    const isValid = corrections.length === 0;

    return {
        sys,
        dia,
        pulse,
        isValid,
        corrections
    };
}