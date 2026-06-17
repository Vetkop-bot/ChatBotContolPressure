import { createWorker, PSM } from 'tesseract.js';
import sharp from 'sharp';

export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width || 1000;
    const height = metadata.height || 1000;

    const cropLeft = 0.20;
    const cropTop = 0.15;
    const cropWidth = 0.60;
    const cropHeight = 0.60;

    return await image
        .extract({
            left: Math.round(width * cropLeft),
            top: Math.round(height * cropTop),
            width: Math.round(width * cropWidth),
            height: Math.round(height * cropHeight),
        })
        .resize({ width: 600 })
        .grayscale()
        .normalize()
        .toBuffer();
}

export async function recognizeWithTesseract(buffer: Buffer): Promise<string> {
    const processed = await preprocessImage(buffer);
    const worker = await createWorker('eng');
    await worker.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: PSM.SINGLE_WORD,
    });
    const { data: { text } } = await worker.recognize(processed);
    await worker.terminate();
    console.log('Tesseract распознал:', text);
    return text;
}