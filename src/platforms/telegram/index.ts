import { Telegraf, Markup } from 'telegraf';
import { setupBotCommands, pendingConfirmations } from './bot';
import { handleMeasurement } from '../../core/measurementHandler';
import { recognizeWithTesseract } from '../../services/ocr/ocr';
import { prisma } from '../../services/database/db';
import { parseNumbers } from '../../core/parsers';

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('BOT_TOKEN is not defined in .env');
    process.exit(1);
}

const bot = new Telegraf(token);

setupBotCommands(bot);

async function handleNewUser(ctx: any) {
    const userId = ctx.from.id;
    const user = await prisma.user.findUnique({
        where: { telegramId: userId }
    });
    if (!user) {
        await prisma.user.create({ data: { telegramId: userId } });
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('Статистика', 'cmd_stats')],
            [Markup.button.callback('Настройки', 'cmd_settings')],
            [Markup.button.callback('Препарат', 'cmd_medication')],
            [Markup.button.callback('Помощь', 'cmd_help')],
        ]);
        await ctx.reply(
            'Здравствуйте! Я бот для контроля давления.\n\n' +
            'Отправьте три числа (систола диастола пульс) через пробел, запятую или слеш.\n' +
            'Пример: 120 80 75\n\n' +
            'Также вы можете отправить фото тонометра – я попробую распознать показания.\n\n' +
            'Используйте кнопки для быстрого доступа:',
            { reply_markup: keyboard.reply_markup }
        );
        return true;
    }
    return false;
}

bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    if (text.startsWith('/')) return;

    const isNew = await handleNewUser(ctx);
    if (isNew) return;

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
        const isNew = await handleNewUser(ctx);
        if (isNew) return;

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

        const parsed = parseNumbers(text);
        if (parsed) {
            pendingConfirmations[userId] = {
                systolic: parsed.systolic,
                diastolic: parsed.diastolic,
                pulse: parsed.pulse
            };
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('Да, всё верно', 'confirm_yes')],
                [Markup.button.callback('Нет, ввести вручную', 'confirm_no')]
            ]);
            await ctx.reply(
                `Распознаны показания:\nСистола: ${parsed.systolic}\nДиастола: ${parsed.diastolic}\nПульс: ${parsed.pulse}\n\nВсё верно?`,
                { reply_markup: keyboard.reply_markup }
            );
            return;
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

bot.launch()
    .then(() => {
        console.log('========================================');
        console.log('Бот контроля давления успешно запущен!');
        console.log(`Время запуска: ${new Date().toLocaleString('ru-RU')}`);
        console.log('Бот готов к работе!');
        console.log('========================================');
    })
    .catch((err) => {
        console.error('Ошибка при запуске бота:', err.message);
        if (err.message.includes('409')) {
            console.error('Конфликт: возможно, бот уже запущен в другом окне.');
            console.error('Закройте все другие экземпляры бота и попробуйте снова.');
        }
        process.exit(1);
    });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));