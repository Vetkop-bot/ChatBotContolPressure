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
    2: '9',
    3: '2',
    4: '3',
    5: '4',
    6: '5',
    7: '6',
    8: '7',
    9: '8'
};
export function postprocessYoloOutput(
    output: Float32Array,
    numClasses: number,
    confidenceThreshold: number = 0.5,
    nmsThreshold: number = 0.5,
    originalWidth: number = 640,
    originalHeight: number = 640
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

        for (let c = 0; c < 10; c++) {
            if (c >= numClasses) continue;
            const prob = output[(4 + c) * numAnchors + i];
            if (prob > maxClassProb) {
                maxClassProb = prob;
                maxClassId = c;
            }
        }

        if (maxClassProb >= confidenceThreshold && maxClassId >= 0 && maxClassId <= 9) {
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
                    className: CLASS_NAMES[maxClassId]
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
): { sys?: string; dia?: string; pulse?: string } {
    if (detections.length === 0) return {};

    console.log(`Всего детекций: ${detections.length}`);

    // 1. Разделяем класс 2 на строки-контейнеры и реальные девятки по координатам
    const class2Dets = detections.filter(d => d.classId === 2);
    const otherDets = detections.filter(d => d.classId !== 2);

    let rowBoxes: YoloDetection[] = [];
    let realNines: YoloDetection[] = [...class2Dets];

    if (class2Dets.length > 0 && otherDets.length > 0) {
        rowBoxes = class2Dets.filter(box => {
            return otherDets.some(d => {
                const cx = (d.x1 + d.x2) / 2;
                const cy = (d.y1 + d.y2) / 2;
                return cx >= box.x1 - 5 && cx <= box.x2 + 5 &&
                    cy >= box.y1 - 5 && cy <= box.y2 + 5;
            });
        });

        realNines = class2Dets.filter(b => !rowBoxes.includes(b));
        console.log(`→ Строк-контейнеров: ${rowBoxes.length}, Реальных девяток: ${realNines.length}`);
    }

    const allDigits = [...otherDets, ...realNines];
    rowBoxes.sort((a, b) => ((a.y1 + a.y2) / 2) - ((b.y1 + b.y2) / 2));

    // 2. Основная логика распределения с восстановлением
    if (rowBoxes.length > 0) {
        console.log(' Используем логику с боксами строк');

        let sysBox = rowBoxes[0];
        let diaBox = rowBoxes[1];
        let pulseBox = rowBoxes[2];

        if (!pulseBox && diaBox) {
            const belowDia = allDigits.filter(d =>
                (d.y1 + d.y2) / 2 > diaBox.y2 + (imageHeight * 0.03)
            );
            if (belowDia.length >= 1) {
                pulseBox = {
                    ...belowDia[0],
                    x1: Math.min(...belowDia.map(d => d.x1)),
                    x2: Math.max(...belowDia.map(d => d.x2)),
                    y1: Math.min(...belowDia.map(d => d.y1)),
                    y2: Math.max(...belowDia.map(d => d.y2))
                };
            }
        }

        const assignToRow = (box: YoloDetection | undefined, label: string, minDigits: number): string => {
            if (!box) return '';

            const boxH = box.y2 - box.y1;
            const expandY = boxH * 0.15;

            const digitsInRow = allDigits.filter(d =>
                d.x1 >= box.x1 - 10 &&
                d.x2 <= box.x2 + 10 &&
                d.y1 >= box.y1 - expandY &&
                d.y2 <= box.y2 + expandY
            );

            digitsInRow.sort((a, b) => a.x1 - b.x1);
            let number = digitsInRow.map(d => d.className).join('');

            // Восстановление пропущенной цифры "9" из бокса-контейнера
            if (number.length < minDigits && rowBoxes.includes(box)) {
                console.log(`   ${label}: "${number}" — мало цифр, восстанавливаем из бокса`);

                const currentDigit = digitsInRow[0];
                const boxCenterX = (box.x1 + box.x2) / 2;
                const digitCenterX = (currentDigit.x1 + currentDigit.x2) / 2;

                const missingNine: YoloDetection = {
                    ...currentDigit,
                    className: '9',
                    classId: 2,
                    confidence: 0.7,
                    x1: digitCenterX > boxCenterX ? box.x1 + 10 : currentDigit.x2 + 15,
                    x2: digitCenterX > boxCenterX ? currentDigit.x1 - 15 : box.x2 - 10,
                    y1: currentDigit.y1,
                    y2: currentDigit.y2
                };

                const restoredDigits = [...digitsInRow, missingNine].sort((a, b) => a.x1 - b.x1);
                number = restoredDigits.slice(0, 4).map(d => d.className).join('');

                console.log(`   ${label}: восстановлено → "${number}"`);
            } else if (number.length < minDigits) {
                console.log(`   ${label}: "${number}" — недостаточно цифр`);
                return '';
            }

            console.log(`  ${label}: ${number} (${number.length} цифр)`);
            return number;
        };

        return {
            sys: assignToRow(sysBox, 'SYS', 3),
            dia: assignToRow(diaBox, 'DIA', 2),
            pulse: assignToRow(pulseBox, 'PULSE', 2)
        };
    }

    // 3. Fallback: группировка по Y без боксов
    console.log(' Нет боксов строк, используем группировку по Y');

    const sorted = [...allDigits].sort((a, b) => {
        const aY = (a.y1 + a.y2) / 2;
        const bY = (b.y1 + b.y2) / 2;
        return aY - bY;
    });

    const yThreshold = imageHeight * 0.15;
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

    const result: { sys?: string; dia?: string; pulse?: string } = {};
    lines.slice(0, 3).forEach((line, idx) => {
        line.sort((a, b) => a.x1 - b.x1);
        const num = line.map(d => d.className).join('');
        console.log(`  Строка ${idx}: ${num}`);
        if (idx === 0) result.sys = num;
        else if (idx === 1) result.dia = num;
        else if (idx === 2) result.pulse = num;
    });

    return result;
}