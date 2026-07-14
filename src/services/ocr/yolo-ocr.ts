import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { postprocessYoloOutput, groupDigitsToNumbers } from './yolo-postprocess';
import { validateAndCorrect } from './yolo-validator';

const DETECTOR_PATH = path.join(__dirname, '../../../models/bestlatest.onnx');

let detectorSession: ort.InferenceSession | null = null;

export async function initYoloModel(): Promise<void> {
    if (!fs.existsSync(DETECTOR_PATH)) {
        throw new Error(`Детектор не найден: ${DETECTOR_PATH}`);
    }

    console.log(' Загрузка модели YOLO детектора...');

    detectorSession = await ort.InferenceSession.create(DETECTOR_PATH, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all'
    });

    console.log(' Детектор загружен');
    console.log(`   Входы: ${detectorSession.inputNames.join(', ')}`);
    console.log(`   Выходы: ${detectorSession.outputNames.join(', ')}`);
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

        const metadata = await sharp(imageBuffer).metadata();
        const origWidth = metadata.width || 640;
        const origHeight = metadata.height || 640;

        const processed = await sharp(imageBuffer)
            .resize(640, 640, { fit: 'fill' })
            .removeAlpha()
            .raw()
            .toBuffer();

        const float32Data = new Float32Array(3 * 640 * 640);
        const numPixels = 640 * 640;

        for (let i = 0; i < numPixels; i++) {
            float32Data[i] = processed[i * 3] / 255.0;
            float32Data[i + numPixels] = processed[i * 3 + 1] / 255.0;
            float32Data[i + numPixels * 2] = processed[i * 3 + 2] / 255.0;
        }

        const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, 640, 640]);
        const feeds: Record<string, ort.Tensor> = {};
        feeds[detectorSession.inputNames[0]] = inputTensor;

        const results = await detectorSession.run(feeds);
        const outputData = results[detectorSession.outputNames[0]].data as Float32Array;

        const detections = postprocessYoloOutput(
            outputData,
            11,
            0.5,
            0.5,
            origWidth,
            origHeight
        );

        console.log(` Найдено ${detections.length} цифр`);

        if (detections.length === 0) {
            return null;
        }

        for (const det of detections) {
            console.log(`  Цифра ${det.className} (класс ${det.classId}, ${(det.confidence * 100).toFixed(1)}%) at (${det.x1.toFixed(0)}, ${det.y1.toFixed(0)})`);
        }

        const grouped = groupDigitsToNumbers(detections, origHeight, origWidth);
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