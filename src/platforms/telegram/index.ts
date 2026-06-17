import { Telegraf } from 'telegraf';
import { handleMeasurement } from '../../core/measurementHandler';
import { setupBotCommands } from './bot';
import {handleCommand} from "../../core/commandHandler";
import {photoHandler} from "./handlers/photoHandler";

const bot = new Telegraf(process.env.BOT_TOKEN!);

setupBotCommands(bot);
bot.on('photo', photoHandler);
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;
    if (text.startsWith('/')) {
        const reply = await handleCommand('telegram', userId, text);
        if (reply) {
            await ctx.reply(reply);
            return;
        }
    }

    const result = await handleMeasurement('telegram', userId, text);if (!result) {
        await ctx.reply(
            'Не удалось распознать три числа.\n' +
            'Пример: 120 80 75'
        );
        return;
    }

    await ctx.reply(result.message);
});

bot.launch().then(() => console.log('Telegram бот запущен'));