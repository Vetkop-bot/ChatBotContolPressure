import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { setupBotCommands } from './bot';
import { photoHandler } from './handlers/photoHandler';
import {saveMeasurement} from "./services/measurementService";


dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('BOT_TOKEN is not defined in .env file');
    process.exit(1);
}

const bot = new Telegraf(token);

setupBotCommands(bot);

function parseThreeNumbers(text: string): { systolic: number; diastolic: number; pulse: number } | null {
    const cleaned = text.replace(/[,;:\/]/g, ' ');
    const parts = cleaned.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length < 3) return null;
    const nums = parts.slice(0, 3).map(Number);
    if (nums.some(isNaN)) return null;
    const [systolic, diastolic, pulse] = nums;
    if (systolic <= 0 || diastolic <= 0 || pulse <= 0 || systolic > 300 || diastolic > 200 || pulse > 250) return null;
    return { systolic, diastolic, pulse };
}
bot.on('photo', photoHandler);
bot.on('text', async (ctx) => {
    const messageText = ctx.message.text;
    const userId = ctx.from.id;
    const username = ctx.from.username || 'без username';

    console.log(`[${new Date().toISOString()}] Получено сообщение от ${username} (${userId}): "${messageText}"`);

    if (messageText.startsWith('/')) return;

    const parsed = parseThreeNumbers(messageText);
    if (parsed) {
        const { systolic, diastolic, pulse } = parsed;
        try {
            await saveMeasurement(userId, systolic, diastolic, pulse);
            await ctx.reply(
                `Сохранено:\n` +
                `Систола: ${systolic}\n` +
                `Диастола: ${diastolic}\n` +
                `Пульс: ${pulse}`
            );
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            await ctx.reply(' Не удалось сохранить данные. Попробуйте позже.');
        }
    } else {
        await ctx.reply(
            'Не удалось распознать три числа.\n' +
            'Убедитесь, что вы отправили систолу, диастолу и пульс через пробел, запятую или слеш.\n' +
            'Пример: `120 80 75`',
            { parse_mode: 'Markdown' }
        );
    }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

bot.launch().then(() => {
    console.log('Бот запущен');
});

export { bot };
