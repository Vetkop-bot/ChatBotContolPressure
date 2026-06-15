import { Telegraf, Context } from "telegraf";
import { Update } from "telegraf/types";

export function setupBotCommands(bot: Telegraf<Context<Update>>) {
    bot.start(async (ctx) => {
        await ctx.reply(
            ' Привет! Я бот для контроля давления.\n\n' +
            'Команды: /start , /help'
        );
    });
    bot.command('help', async (ctx) => {
        await ctx.reply(
            ' *Справка*\n\n'  +
            'В будущем я смогу:\n' +
            '• принимать давление (125 85 70)\n' +
            '• вычислять пульсовое давление, тройное произведение, индекс Кердо\n' +
            '• сохранять историю и давать рекомендации\n\n' +
            { parse_mode: 'Markdown' }
        );
    });
}
