import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { postprocessYoloOutput, groupDigitsToNumbers } from './yolo-postprocess';
import { validateAndCorrect } from './yolo-validator';

const DETECTOR_PATH = path.join(__dirname, '../../../models/detector.onnx');

let detectorSession: ort.InferenceSession | null = null;

export async function initYoloModel(): Promise<void> {
    if (!fs.existsSync(DETECTOR_PATH)) {
        throw new Error(`Детектор не найден: ${DETECTOR_PATH}`);
    }

    detectorSession = await ort.InferenceSession.create(DETECTOR_PATH, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all'
    });

    console.log(' Детектор загружен');
    console.log(`   Входы: ${detectorSession.inputNames.join(', ')}`);
    console.log(`   Выходы: ${detectorSession.outputNames.join(', ')}`);
}

async function preprocessImage(
    imageBuffer: Buffer,
    targetSize: number = 640
): Promise<{ inputTensor: ort.Tensor; scale: number }> {
    const metadata = await sharp(imageBuffer).metadata();
    const origWidth = metadata.width || targetSize;
    const scale = origWidth / targetSize;

    const enhanced = await sharp(imageBuffer)
        .grayscale()
        .modulate({ brightness: 1.2 })
        .gamma(1.4)
        .sharpen({ sigma: 2 })
        .resize(targetSize, targetSize, {
            fit: 'fill',
            kernel: sharp.kernel.lanczos3
        })
        .raw()
        .toBuffer();

    const float32Data = new Float32Array(3 * targetSize * targetSize);
    const numPixels = targetSize * targetSize;

    for (let i = 0; i < numPixels; i++) {
        const normalized = enhanced[i] / 255.0;
        float32Data[i] = normalized;
        float32Data[i + numPixels] = normalized;
        float32Data[i + numPixels * 2] = normalized;
    }

    return {
        inputTensor: new ort.Tensor('float32', float32Data, [1, 3, targetSize, targetSize]),
        scale
    };
}

export async function recognizeWithYolo(
    imageBuffer: Buffer
): Promise<{ sys?: string; dia?: string; pulse?: string } | null> {
    if (!detectorSession) {
        await initYoloModel();
    }

    if (!detectorSession) {
        throw new Error('Детектор не загружен');
    }

    try {
        const startTime = Date.now();
        const { inputTensor, scale } = await preprocessImage(imageBuffer, 640);

        const feeds: Record<string, ort.Tensor> = {};
        feeds[detectorSession.inputNames[0]] = inputTensor;

        const results = await detectorSession.run(feeds);
        const outputData = results[detectorSession.outputNames[0]].data as Float32Array;

        const detections = postprocessYoloOutput(
            outputData,
            11,
            0.5,
            0.5,
            640 / scale,
            640 / scale
        );

        console.log(` Найдено ${detections.length} цифр`);

        const hasDigit1 = detections.some(d => d.classId === 1);
        if (!hasDigit1) {
            console.log('Цифра "1" не найдена, дополнительный поиск с порогом 0.15...');
            const detectionsClass1 = postprocessYoloOutput(
                outputData,
                11,
                0.15,
                0.5,
                640 / scale,
                640 / scale,
                1
            );
            detections.push(...detectionsClass1);
            console.log(`Добавлено ${detectionsClass1.length} детекций "1"`);
        }

        if (detections.length === 0) {
            return null;
        }

        for (const det of detections) {
            console.log(`  Цифра ${det.className} (класс ${det.classId}, ${(det.confidence * 100).toFixed(1)}%) at (${det.x1.toFixed(0)}, ${det.y1.toFixed(0)})`);
        }

        const grouped = groupDigitsToNumbers(detections, 640 / scale, 640 / scale);
        console.log(' Сгруппировано:', grouped);

        const elapsed = Date.now() - startTime;
        console.log(` Всего времени: ${elapsed}ms`);

        return grouped;
    } catch (error) {
        console.error(' Ошибка распознавания:', error);
        return null;
    }
}

export async function recognizeYoloToText(imageBuffer: Buffer): Promise<string | null> {
    const result = await recognizeWithYolo(imageBuffer);

    if (!result) return null;

    console.log(' Сырые данные:', result);

    const validated = validateAndCorrect(result);

    if (validated.corrections.length > 0) {
        console.log(' Исправления:', validated.corrections.join('; '));
    }

    if (validated.variants && validated.variants.length > 0) {
        const bestVariant = validated.variants[0];
        const text = `${bestVariant.sys} ${bestVariant.dia} ${bestVariant.pulse}`;
        console.log(' Финальный результат:', text);
        return text;
    }

    if (!validated.isValid) {
        console.log(' Данные не прошли валидацию');
        return null;
    }

    const text = `${validated.sys} ${validated.dia} ${validated.pulse}`;
    console.log(' Финальный результат:', text);

    return text;
}