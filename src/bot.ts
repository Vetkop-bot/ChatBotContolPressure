import { Telegraf, Context } from "telegraf";
import { Update } from "telegraf/types";
import {prisma} from "./db";

export function setupBotCommands(bot: Telegraf<Context<Update>>) {
    bot.start(async (ctx) => {
        await ctx.reply(
            ' Привет! Я бот для контроля давления.\n\n' +
            'Команды: /start , /help, /stats'
        );
    });
    bot.command('help', async (ctx) => {
        await ctx.reply(
            ' *Справка*\n\n'  +
            'В будущем я смогу:\n' +
            '• принимать давление (125 85 70)\n' +
            '• вычислять пульсовое давление, тройное произведение, индекс Кердо\n' +
            '• сохранять историю и давать рекомендации\n\n'
        );
    });
    bot.command('stats', async (ctx) => {
        const telegramId = ctx.from.id;
        const user = await prisma.user.findUnique({
            where: { telegramId },
            include: {
                measurements: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                }
            }
        });

        if (!user || user.measurements.length === 0) {
            await ctx.reply('Нет сохранённых измерений.');
            return;
        }

        let reply = ' Последние 5 замеров:\n';
        user.measurements.forEach((m, i) => {
            reply += `${i+1}. ${m.systolic}/${m.diastolic} (пульс ${m.pulse}) — ${new Date(m.createdAt).toLocaleString()}\n`;
        });
        await ctx.reply(reply);
    });
}
