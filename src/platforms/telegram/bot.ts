import { Telegraf, Context, Markup } from "telegraf";
import { Update } from "telegraf/types";
import { handleCommand } from "../../core/commandHandler";
import { getUserSettings } from "../../core/userSettings";

export function setupBotCommands(bot: Telegraf<Context<Update>>) {
    bot.start(async (ctx) => {
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback(' Статистика', 'cmd_stats')],
            [Markup.button.callback(' Настройки', 'cmd_settings')],
            [Markup.button.callback(' Препарат', 'cmd_medication')],
            [Markup.button.callback(' Помощь', 'cmd_help')],
            [Markup.button.url(' Документация', 'https://github.com/Vetkop-bot/ChatBotContolPressure')]
        ]);
        const reply = await handleCommand('telegram', ctx.from.id, '/start');
        await ctx.reply(reply || 'Привет! Я бот для контроля давления.', {
            reply_markup: keyboard.reply_markup,
            parse_mode: 'Markdown'
        });
    });

    bot.command('help', async (ctx) => {
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback(' Статистика', 'cmd_stats')],
            [Markup.button.callback(' Настройки', 'cmd_settings')],
            [Markup.button.callback(' Препарат', 'cmd_medication')],
            [Markup.button.callback(' Назад', 'cmd_start')]
        ]);
        const reply = await handleCommand('telegram', ctx.from.id, '/help');
        await ctx.reply(reply || 'Справка по боту.', {
            reply_markup: keyboard.reply_markup,
            parse_mode: 'Markdown'
        });
    });

    bot.action('cmd_start', async (ctx) => {
        await ctx.answerCbQuery();
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback(' Статистика', 'cmd_stats')],
            [Markup.button.callback(' Настройки', 'cmd_settings')],
            [Markup.button.callback(' Препарат', 'cmd_medication')],
            [Markup.button.callback(' Помощь', 'cmd_help')]
        ]);
        const reply = await handleCommand('telegram', ctx.from.id, '/start');
        await ctx.editMessageText(reply || 'Главное меню.', {
            reply_markup: keyboard.reply_markup,
            parse_mode: 'Markdown'
        });
    });

    bot.action('cmd_help', async (ctx) => {
        await ctx.answerCbQuery();
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback(' Статистика', 'cmd_stats')],
            [Markup.button.callback(' Настройки', 'cmd_settings')],
            [Markup.button.callback(' Назад', 'cmd_start')]
        ]);
        const reply = await handleCommand('telegram', ctx.from.id, '/help');
        await ctx.editMessageText(reply || 'Справка по боту.', {
            reply_markup: keyboard.reply_markup,
            parse_mode: 'Markdown'
        });
    });

    bot.action('cmd_stats', async (ctx) => {
        await ctx.answerCbQuery();
        const reply = await handleCommand('telegram', ctx.from.id, '/stats');
        await ctx.reply(reply || 'Нет данных.', { parse_mode: 'Markdown' });
    });

    bot.action('cmd_settings', async (ctx) => {
        await ctx.answerCbQuery();
        const reply = await handleCommand('telegram', ctx.from.id, '/settings');
        await ctx.reply(reply || 'Настройки не найдены.', { parse_mode: 'Markdown' });
    });

    bot.action('cmd_medication', async (ctx) => {
        await ctx.answerCbQuery();
        const settings = await getUserSettings('telegram', ctx.from.id);
        const med = settings?.medication || 'не задан';
        await ctx.reply(
            ` Ваш препарат: *${med}*\n\n` +
            'Чтобы изменить, отправьте команду:\n' +
            '`/set_medication Название препарата`',
            { parse_mode: 'Markdown' }
        );
    });

    bot.command('stats', async (ctx) => {
        const reply = await handleCommand('telegram', ctx.from.id, '/stats');
        if (reply) await ctx.reply(reply, { parse_mode: 'Markdown' });
    });

    bot.command('settings', async (ctx) => {
        const reply = await handleCommand('telegram', ctx.from.id, '/settings');
        if (reply) await ctx.reply(reply, { parse_mode: 'Markdown' });
    });

    bot.command('set_medication', async (ctx) => {
        const text = ctx.message.text;
        const reply = await handleCommand('telegram', ctx.from.id, text);
        if (reply) await ctx.reply(reply, { parse_mode: 'Markdown' });
    });

    bot.command('set_norm', async (ctx) => {
        const text = ctx.message.text;
        const reply = await handleCommand('telegram', ctx.from.id, text);
        if (reply) await ctx.reply(reply, { parse_mode: 'Markdown' });
    });

    bot.command('set_notifications', async (ctx) => {
        const text = ctx.message.text;
        const reply = await handleCommand('telegram', ctx.from.id, text);
        if (reply) await ctx.reply(reply, { parse_mode: 'Markdown' });
    });
}