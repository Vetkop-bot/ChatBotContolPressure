import { Telegraf, Context } from "telegraf";
import { Update } from "telegraf/types";

export function setupBotCommands(bot: Telegraf<Context<Update>>) {
    bot.start(async (ctx: { reply: (arg0: string) => any; }) => {
        await ctx.reply('Привет! Отправь три числа: систолу, диастолу, пульс.\nКоманды: /set_medication Каптоприл , /stats');
    });
    bot.command('help', async (ctx) => {
        await ctx.reply(
            ' *Справка по боту*\n\n' ,
            { parse_mode: 'Markdown' }
        );
    });
}
