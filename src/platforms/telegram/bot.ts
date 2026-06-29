import { Telegraf, Context, Markup } from "telegraf";
import { Update } from "telegraf/types";
import { handleCommand } from "../../core/commandHandler";
import { getUserSettings, updateUserSettings } from "../../core/userSettings";
import {handleMeasurement} from "../../core/measurementHandler";

const userStates: Record<number, { step: string | null }> = {};

function mainMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback(' Ввести давление', 'enter_pressure')],
        [Markup.button.callback(' Фото тонометра', 'take_photo')],
        [Markup.button.callback(' Статистика', 'cmd_stats')],
        [Markup.button.callback(' Настройки', 'cmd_settings')],
        [Markup.button.callback(' Помощь', 'cmd_help')]
    ]);
}

function settingsMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback(' Препарат', 'set_medication')],
        [Markup.button.callback(' Норма давления', 'set_norm')],
        [Markup.button.callback(' Уведомления', 'set_notifications')],
        [Markup.button.callback(' Главное меню', 'cmd_start')]
    ]);
}

function backButton() {
    return Markup.inlineKeyboard([
        [Markup.button.callback(' Назад', 'cmd_start')]
    ]);
}

function notificationsMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback(' Включить', 'notif_on')],
        [Markup.button.callback(' Выключить', 'notif_off')],
        [Markup.button.callback(' Назад', 'cmd_settings')]
    ]);
}

export function setupBotCommands(bot: Telegraf<Context<Update>>) {
    bot.start(async (ctx) => {
        const userId = ctx.from.id;
        userStates[userId] = { step: null };
        const reply = await handleCommand('telegram', userId, '/start');
        await ctx.reply(reply || 'Главное меню', {
            reply_markup: mainMenu().reply_markup,
            parse_mode: 'Markdown'
        });
    });

    bot.action('cmd_start', async (ctx) => {
        const userId = ctx.from.id;
        userStates[userId] = { step: null };
        await ctx.answerCbQuery();
        const reply = await handleCommand('telegram', userId, '/start');
        await ctx.editMessageText(reply || 'Главное меню', {
            reply_markup: mainMenu().reply_markup,
            parse_mode: 'Markdown'
        });
    });

    bot.action('enter_pressure', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        userStates[userId] = { step: null };
        await ctx.reply(
            ' Отправьте три числа через пробел, запятую или слеш:\n' +
            'Пример: `120 80 75`',
            { parse_mode: 'Markdown', reply_markup: backButton().reply_markup }
        );
    });

    bot.action('take_photo', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        userStates[userId] = { step: null };
        await ctx.reply(
            ' Отправьте фото экрана тонометра.\n' +
            'Я постараюсь распознать показания.',
            { reply_markup: backButton().reply_markup }
        );
    });

    bot.action('cmd_stats', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        userStates[userId] = { step: null };
        const reply = await handleCommand('telegram', userId, '/stats');
        await ctx.reply(reply || 'Нет данных.', {
            parse_mode: 'Markdown',
            reply_markup: backButton().reply_markup
        });
    });

    bot.action('cmd_settings', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        userStates[userId] = { step: null };
        const reply = await handleCommand('telegram', userId, '/settings');
        await ctx.reply(reply || 'Настройки не найдены.', {
            parse_mode: 'Markdown',
            reply_markup: settingsMenu().reply_markup
        });
    });

    bot.action('cmd_help', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        userStates[userId] = { step: null };
        const reply = await handleCommand('telegram', userId, '/help');
        await ctx.reply(reply || 'Справка.', {
            parse_mode: 'Markdown',
            reply_markup: backButton().reply_markup
        });
    });

    bot.action('set_medication', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        userStates[userId] = { step: 'waiting_medication' };
        await ctx.reply(
            ' Введите название препарата (например, *Каптоприл 25 мг*):',
            { parse_mode: 'Markdown', reply_markup: backButton().reply_markup }
        );
    });

    bot.action('set_norm', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        userStates[userId] = { step: 'waiting_norm' };
        await ctx.reply(
            ' Введите вашу целевую норму давления через пробел (систола и диастола):\n' +
            'Пример: `130 80`',
            { parse_mode: 'Markdown', reply_markup: backButton().reply_markup }
        );
    });

    bot.action('set_notifications', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        userStates[userId] = { step: null };
        const settings = await getUserSettings('telegram', userId);
        const status = settings?.notificationsEnabled ? 'включены' : 'отключены';
        await ctx.reply(
            ` Сейчас уведомления *${status}*.\n\nВыберите действие:`,
            { parse_mode: 'Markdown', reply_markup: notificationsMenu().reply_markup }
        );
    });

    bot.action('notif_on', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        await updateUserSettings('telegram', userId, { notificationsEnabled: true });
        await ctx.reply(' Уведомления включены.', { reply_markup: settingsMenu().reply_markup });
    });

    bot.action('notif_off', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        await updateUserSettings('telegram', userId, { notificationsEnabled: false });
        await ctx.reply(' Уведомления выключены.', { reply_markup: settingsMenu().reply_markup });
    });

    bot.on('text', async (ctx) => {
        const userId = ctx.from.id;
        const text = ctx.message.text;

        if (text.startsWith('/')) return;

        const state = userStates[userId]?.step;

        if (state === 'waiting_medication') {
            await updateUserSettings('telegram', userId, { medication: text });
            userStates[userId] = { step: null };
            await ctx.reply(` Препарат "${text}" сохранён.`, {
                reply_markup: settingsMenu().reply_markup
            });
            return;
        }

        if (state === 'waiting_norm') {
            const parts = text.trim().split(/\s+/);
            if (parts.length >= 2) {
                const sys = parseInt(parts[0], 10);
                const dia = parseInt(parts[1], 10);
                if (!isNaN(sys) && !isNaN(dia) && sys > 0 && dia > 0) {
                    await updateUserSettings('telegram', userId, {
                        targetSystolic: sys,
                        targetDiastolic: dia
                    });
                    userStates[userId] = { step: null };
                    await ctx.reply(` Целевое давление установлено: ${sys}/${dia}.`, {
                        reply_markup: settingsMenu().reply_markup
                    });
                    return;
                } else {
                    await ctx.reply(
                        ' Некорректные числа. Введите два положительных числа через пробел.\n' +
                        'Пример: `130 80`',
                        { parse_mode: 'Markdown' }
                    );
                    return;
                }
            } else {
                await ctx.reply(
                    ' Нужно ввести два числа (систола и диастола) через пробел.\n' +
                    'Пример: `130 80`',
                    { parse_mode: 'Markdown' }
                );
                return;
            }
        }

        const result = await handleMeasurement('telegram', userId, text);
        if (result) {
            await ctx.reply(result.message, { parse_mode: 'Markdown' });
        } else {
            await ctx.reply(
                ' Не удалось распознать три числа.\n' +
                'Отправьте систолу, диастолу и пульс через пробел, запятую или слеш.\n' +
                'Пример: `120 80 75`',
                { parse_mode: 'Markdown' }
            );
        }
    });
}