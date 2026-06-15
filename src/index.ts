import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { setupBotCommands } from './bot';

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('BOT_TOKEN is not defined in .env file');
    process.exit(1);
}

const bot = new Telegraf(token);

setupBotCommands(bot);

// Временно отключаем обработку сообщений с показаниями
bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    await ctx.reply(
        ' Функция анализа давления временно отключена для упрощения запуска.\n' ,
    );
});

bot.on('photo', async (ctx) => {
    await ctx.reply(
        ' Функция распознавания фото временно отключена.\n',
    );
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

bot.launch().then(() => {
    console.log('Бот запущен');
});

export { bot };
