import express, { Request, Response } from 'express';
import { handleMeasurement } from '../../core/measurementHandler';
import {handleCommand} from "../../core/commandHandler";

const app = express();
app.use(express.json());

app.post('/webhook/max', async (req: Request, res: Response) => {
    const update = req.body;
    console.log('Получен update от MAX:', JSON.stringify(update, null, 2));

    if (update.update_type === 'message_created') {
        const userId = update.user?.id;
        const text = update.message?.text;

        if (userId && text) {
            if (text.startsWith('/')) {
                const reply = await handleCommand('max', userId, text);
                if (reply) {
                    await sendMessageToMax(userId, reply);
                    return res.sendStatus(200);
                }
            }

            const result = await handleMeasurement('max', userId, text);
            if (result) {
                await sendMessageToMax(userId, result.message);
            } else {
                await sendMessageToMax(userId, 'Не удалось распознать три числа. Пример: 120 80 75');
            }
        }
    }

    res.sendStatus(200);
})

async function sendMessageToMax(userId: number, text: string) {
    const url = 'https://platform-api.max.ru/messages';
    const token = process.env.MAX_BOT_TOKEN;

    if (!token) {
        console.error('MAX_BOT_TOKEN не задан в .env');
        return;
    }

    try {
        await fetch(`${url}?user_id=${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });
        console.log(`Сообщение отправлено пользователю ${userId}`);
    } catch (error) {
        console.error('Ошибка отправки сообщения в MAX:', error);
    }
}

// Запуск сервера
const PORT = process.env.MAX_PORT || 3000;
app.listen(PORT, () => {
    console.log(` MAX bot server running on port ${PORT}`);
});