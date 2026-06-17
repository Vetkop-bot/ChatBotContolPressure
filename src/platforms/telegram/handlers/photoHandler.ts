import { Context } from 'telegraf';
import { parseThreeNumbers } from '../../../core/parsers';
import { saveMeasurement } from '../../../services/database/measurementService';
import { recognizeWithTesseract, preprocessImage } from '../../../services/ocr/ocr';

export async function photoHandler(ctx: Context) {
    if (!ctx.message || !('photo' in ctx.message)) return;
    if (!ctx.from) {
        await ctx.reply('Не удалось определить отправителя.');
        return;
    }

    const telegramId = ctx.from.id;

    try {
        await ctx.reply('Распознаю показания...');

        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        const response = await fetch(fileLink.href);
        const buffer = Buffer.from(await response.arrayBuffer());

        const processed = await preprocessImage(buffer);
        await ctx.replyWithPhoto(
            { source: processed },
            { caption: ' Обработанное изображение (для отладки)' }
        );

        const text = await recognizeWithTesseract(buffer);
        console.log('Распознанный текст:', text);

        if (!text) {
            await ctx.reply(' Не удалось распознать цифры. Введите вручную.');
            return;
        }

        const parsed = parseThreeNumbers(text);
        if (!parsed) {
            await ctx.reply(
                ` Не смог извлечь три числа. Распознано: "${text}"\n` +
                'Введите вручную: систола диастола пульс'
            );
            return;
        }

        const { systolic, diastolic, pulse } = parsed;

        await saveMeasurement('telegram', telegramId, systolic, diastolic, pulse);

        await ctx.reply(
            `Распознано и сохранено:\n` +
            `Систола: ${systolic}\n` +
            `Диастола: ${diastolic}\n` +
            `Пульс: ${pulse}`
        );
    } catch (error) {
        console.error('Ошибка при обработке фото:', error);
        await ctx.reply('Произошла ошибка. Введите данные вручную.');
    }
}