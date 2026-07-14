import { generatePressureVariants, PressureVariant } from './yolo-alternatives';

export interface PressureReading {
    sys?: string;
    dia?: string;
    pulse?: string;
}

export interface ValidatedReading {
    sys: number;
    dia: number;
    pulse: number;
    isValid: boolean;
    corrections: string[];
    variants?: PressureVariant[];
}

export function validateAndCorrect(reading: PressureReading): ValidatedReading {
    const corrections: string[] = [];

    let sys = parseInt(reading.sys || '0', 10);
    let dia = parseInt(reading.dia || '0', 10);
    let pulse = parseInt(reading.pulse || '0', 10);

    if (isNaN(sys)) sys = 0;
    if (isNaN(dia)) dia = 0;
    if (isNaN(pulse)) pulse = 0;

    const isSysValid = sys >= 70 && sys <= 250;
    const isDiaValid = dia >= 40 && dia <= 160;
    const isPulseValid = pulse >= 30 && pulse <= 200;

    if (!isSysValid && sys !== 0) {
        corrections.push(`SYS ${sys} вне диапазона 70-250`);
    }
    if (!isDiaValid && dia !== 0) {
        corrections.push(`DIA ${dia} вне диапазона 40-160`);
    }
    if (!isPulseValid && pulse !== 0) {
        corrections.push(`PULSE ${pulse} вне диапазона 30-200`);
    }

    if (sys > 0 && dia > 0 && sys <= dia) {
        corrections.push(`SYS (${sys}) <= DIA (${dia})`);
    }

    const isValid = (sys === 0 || isSysValid) && (dia === 0 || isDiaValid) &&
        (pulse === 0 || isPulseValid) && (sys === 0 || dia === 0 || sys > dia);

    const variants: PressureVariant[] = [];
    if (reading.sys && reading.dia && reading.pulse) {
        const altVariants = generatePressureVariants(reading.sys, reading.dia, reading.pulse, 5);
        variants.push(...altVariants);
    }

    return {
        sys, dia, pulse, isValid, corrections,
        variants: variants.length > 0 ? variants : undefined
    };
}