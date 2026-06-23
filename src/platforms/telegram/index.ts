import { Telegraf } from 'telegraf';
import { setupBotCommands } from './bot';
import { handleCommand } from '../../core/commandHandler';
import { handleMeasurement } from '../../core/measurementHandler';
import { recognizeWithTesseract } from '../../services/ocr/ocr';

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('BOT_TOKEN is not defined in .env');
    process.exit(1);
}

const bot = new Telegraf(token);

setupBotCommands(bot);

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    if (text.startsWith('/')) {
        const reply = await handleCommand('telegram', userId, text);
        if (reply) {
            await ctx.reply(reply);
        }
        return;
    }

    const result = await handleMeasurement('telegram', userId, text);
    if (result) {
        await ctx.reply(result.message);
    } else {
        await ctx.reply(
            'Не удалось распознать три числа.\n' +
            'Отправьте систолу, диастолу и пульс через пробел, запятую или слеш.\n' +
            'Пример: `120 80 75`',
            { parse_mode: 'Markdown' }
        );
    }
});

bot.on('photo', async (ctx) => {
    const userId = ctx.from.id;
    try {
        await ctx.reply('Распознаю показания...');

        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        const response = await fetch(fileLink.href);
        const buffer = Buffer.from(await response.arrayBuffer());

        const text = await recognizeWithTesseract(buffer);
        console.log('Распознанный текст с фото:', text);

        if (!text) {
            await ctx.reply(
                'Не удалось распознать цифры на фото.\n' +
                'Пожалуйста, введите показания вручную: три числа (систола диастола пульс)'
            );
            return;
        }

        const result = await handleMeasurement('telegram', userId, text);
        if (result) {
            await ctx.reply(result.message);
        } else {
            await ctx.reply(
                `Распознал текст, но не смог извлечь три числа.\n` +
                `Распознано: "${text}"\n` +
                `Введите вручную: три числа (систола диастола пульс)`
            );
        }
    } catch (error) {
        console.error('Ошибка при обработке фото:', error);
        await ctx.reply(
            'Произошла ошибка при распознавании.\n' +
            'Введите данные вручную: три числа (систола диастола пульс)'
        );
    }
});

// Запуск бота
bot.launch().then(() => console.log('Telegram бот запущен'));

// Обработка завершения
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));