export interface YoloDetection {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence: number;
    classId: number;
    className: string;
}

const CLASS_NAMES: Record<number, string> = {
    0: '0',
    1: '1',
    2: '10',
    3: '2',
    4: '3',
    5: '4',
    6: '5',
    7: '6',
    8: '7',
    9: '8',
    10: '9'
};
export function postprocessYoloOutput(
    output: Float32Array,
    numClasses: number,
    confidenceThreshold: number = 0.5,
    nmsThreshold: number = 0.5,
    originalWidth: number = 640,
    originalHeight: number = 640,
    classFilter: number | null = null
): YoloDetection[] {
    const numAnchors = 8400;
    const detections: YoloDetection[] = [];

    for (let i = 0; i < numAnchors; i++) {
        const cx = output[i];
        const cy = output[numAnchors + i];
        const w = output[2 * numAnchors + i];
        const h = output[3 * numAnchors + i];

        let maxClassProb = 0;
        let maxClassId = -1;

        for (let c = 0; c < numClasses; c++) {
            if (classFilter !== null && c !== classFilter) continue;

            const prob = output[(4 + c) * numAnchors + i];
            if (prob > maxClassProb) {
                maxClassProb = prob;
                maxClassId = c;
            }
        }

        if (maxClassProb >= confidenceThreshold && maxClassId >= 0 && maxClassId < numClasses) {
            const x1 = Math.max(0, ((cx - w / 2) / 640) * originalWidth);
            const y1 = Math.max(0, ((cy - h / 2) / 640) * originalHeight);
            const x2 = Math.min(originalWidth, ((cx + w / 2) / 640) * originalWidth);
            const y2 = Math.min(originalHeight, ((cy + h / 2) / 640) * originalHeight);

            const boxWidth = x2 - x1;
            const boxHeight = y2 - y1;
            const minSize = Math.min(originalWidth, originalHeight) * 0.02;
            const maxSize = Math.min(originalWidth, originalHeight) * 0.25;
            const aspectRatio = boxHeight / boxWidth;

            if (boxWidth >= minSize && boxWidth <= maxSize &&
                boxHeight >= minSize && boxHeight <= maxSize &&
                aspectRatio >= 0.5 && aspectRatio <= 3.5) {
                detections.push({
                    x1, y1, x2, y2,
                    confidence: maxClassProb,
                    classId: maxClassId,
                    className: CLASS_NAMES[maxClassId] || String(maxClassId)
                });
            }
        }
    }

    console.log(`До NMS: ${detections.length} детекций`);
    return applyNMS(detections, nmsThreshold);
}

function applyNMS(detections: YoloDetection[], threshold: number): YoloDetection[] {
    detections.sort((a, b) => b.confidence - a.confidence);
    const result: YoloDetection[] = [];
    while (detections.length > 0) {
        const best = detections.shift()!;
        result.push(best);
        detections = detections.filter(det => calculateIoU(best, det) < threshold);
    }
    console.log(`После NMS: ${result.length} детекций`);
    return result;
}

function calculateIoU(a: YoloDetection, b: YoloDetection): number {
    const x1 = Math.max(a.x1, b.x1);
    const y1 = Math.max(a.y1, b.y1);
    const x2 = Math.min(a.x2, b.x2);
    const y2 = Math.min(a.y2, b.y2);
    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
    const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
    const union = areaA + areaB - intersection;
    return union > 0 ? intersection / union : 0;
}

export function groupDigitsToNumbers(
    detections: YoloDetection[],
    imageHeight: number,
    imageWidth: number
): { sys?: string; dia?: string; pulse?: string } {
    if (detections.length === 0) return {};

    console.log(`Всего детекций: ${detections.length}`);

    const class2Dets = detections.filter((d: YoloDetection) => d.classId === 2);
    const otherDets = detections.filter((d: YoloDetection) => d.classId !== 2);

    let rowBoxes: YoloDetection[] = [];
    let realNines: YoloDetection[] = [...class2Dets];

    if (class2Dets.length > 0 && otherDets.length > 0) {
        rowBoxes = class2Dets.filter(box => {
            return otherDets.some((d: YoloDetection) => {
                const cx = (d.x1 + d.x2) / 2;
                const cy = (d.y1 + d.y2) / 2;
                return cx >= box.x1 - 5 && cx <= box.x2 + 5 &&
                    cy >= box.y1 - 5 && cy <= box.y2 + 5;
            });
        });

        realNines = class2Dets.filter(b => !rowBoxes.includes(b));
        console.log(`Строк-контейнеров: ${rowBoxes.length}`);
    }

    const allDigits = [...otherDets, ...realNines];
    rowBoxes.sort((a, b) => ((a.y1 + a.y2) / 2) - ((b.y1 + b.y2) / 2));

    if (rowBoxes.length < 3) {
        console.log(`Найдено только ${rowBoxes.length} контейнеров (нужно 3). Используем Y-группировку.`);

        const sorted = [...allDigits].sort((a, b) => {
            const aY = (a.y1 + a.y2) / 2;
            const bY = (b.y1 + b.y2) / 2;
            return aY - bY;
        });

        const digitDetections = allDigits.filter((d: YoloDetection) => d.classId !== 2);
        const avgHeight = digitDetections.reduce((sum, d) => sum + (d.y2 - d.y1), 0) / digitDetections.length;
        const yThreshold = Math.min(avgHeight * 0.5, 25);

        console.log(`Средняя высота цифр: ${avgHeight.toFixed(1)}px, порог Y: ${yThreshold.toFixed(1)}px`);

        const lines: YoloDetection[][] = [];
        let currentLine: YoloDetection[] = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            const prevY = (currentLine[currentLine.length - 1].y1 + currentLine[currentLine.length - 1].y2) / 2;
            const currY = (sorted[i].y1 + sorted[i].y2) / 2;

            if (Math.abs(currY - prevY) < yThreshold) {
                currentLine.push(sorted[i]);
            } else {
                lines.push(currentLine);
                currentLine = [sorted[i]];
            }
        }
        if (currentLine.length > 0) lines.push(currentLine);

        console.log(`Найдено строк: ${lines.length}`);

        const result: { sys?: string; dia?: string; pulse?: string } = {};
        lines.slice(0, 3).forEach((line, idx) => {
            line.sort((a, b) => a.x1 - b.x1);
            const num = line.map((d: YoloDetection) => d.className).join('');
            console.log(`Строка ${idx}: ${num} (${line.length} цифр)`);
            if (idx === 0) result.sys = num;
            else if (idx === 1) result.dia = num;
            else if (idx === 2) result.pulse = num;
        });

        const validateBP = (sys: string, dia: string, pulse: string): boolean => {
            const sysNum = parseInt(sys, 10);
            const diaNum = parseInt(dia, 10);
            const pulseNum = parseInt(pulse, 10);

            if (isNaN(sysNum) || isNaN(diaNum) || isNaN(pulseNum)) return false;
            if (sysNum < 70 || sysNum > 250) return false;
            if (diaNum < 40 || diaNum > 160) return false;
            if (pulseNum < 30 || pulseNum > 200) return false;
            if (sysNum <= diaNum) return false;

            return true;
        };

        const sys = result.sys || '';
        const dia = result.dia || '';
        const pulse = result.pulse || '';

        console.log(`Проверка валидности: SYS=${sys}, DIA=${dia}, PULSE=${pulse}`);
        const isValid = validateBP(sys, dia, pulse);
        console.log(`Валидно: ${isValid}`);

        if (!isValid) {
            console.log(`Результат не валиден, пробуем восстановление...`);

            if (sys.startsWith('1') && dia.length === sys.length - 1) {
                const newDia = '1' + dia;
                if (validateBP(sys, newDia, pulse)) {
                    console.log(`Восстановление DIA: "${dia}" -> "${newDia}" (прошло валидацию)`);
                    result.dia = newDia;
                } else {
                    console.log(`Восстановление DIA: "${dia}" -> "${newDia}" (не прошло валидацию)`);
                }
            }

            if (dia.startsWith('1') && pulse.length === dia.length - 1) {
                const newPulse = '1' + pulse;
                if (validateBP(sys, dia, newPulse)) {
                    console.log(`Восстановление PULSE: "${pulse}" -> "${newPulse}" (прошло валидацию)`);
                    result.pulse = newPulse;
                } else {
                    console.log(`Восстановление PULSE: "${pulse}" -> "${newPulse}" (не прошло валидацию)`);
                }
            }
        }

        console.log(`Финально: SYS=${result.sys}, DIA=${result.dia}, PULSE=${result.pulse}`);
        return result;
    }

    console.log('Используем логику с боксами строк');

    let sysBox = rowBoxes[0];
    let diaBox = rowBoxes[1];
    let pulseBox = rowBoxes[2];

    if (!pulseBox && diaBox) {
        const belowDia = allDigits.filter((d: YoloDetection) =>
            (d.y1 + d.y2) / 2 > diaBox.y2 + (imageHeight * 0.03)
        );
        if (belowDia.length >= 1) {
            pulseBox = {
                ...belowDia[0],
                x1: Math.min(...belowDia.map((d: YoloDetection) => d.x1)),
                x2: Math.max(...belowDia.map((d: YoloDetection) => d.x2)),
                y1: Math.min(...belowDia.map((d: YoloDetection) => d.y1)),
                y2: Math.max(...belowDia.map((d: YoloDetection) => d.y2))
            };
        }
    }

    const assignToRow = (box: YoloDetection | undefined, label: string, minDigits: number): string => {
        if (!box) return '';

        const boxH = box.y2 - box.y1;
        const expandY = boxH * 0.15;

        const digitsInRow = allDigits.filter((d: YoloDetection) =>
            d.x1 >= box.x1 - 10 &&
            d.x2 <= box.x2 + 10 &&
            d.y1 >= box.y1 - expandY &&
            d.y2 <= box.y2 + expandY
        );

        digitsInRow.sort((a, b) => a.x1 - b.x1);
        let number = digitsInRow.map((d: YoloDetection) => d.className).join('');

        if (number.length < minDigits) {
            console.log(`${label}: "${number}" - недостаточно цифр`);
            return '';
        }

        console.log(`${label}: ${number} (${number.length} цифр)`);
        return number;
    };

    return {
        sys: assignToRow(sysBox, 'SYS', 2),
        dia: assignToRow(diaBox, 'DIA', 2),
        pulse: assignToRow(pulseBox, 'PULSE', 2)
    };
}