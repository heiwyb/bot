require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { Client } = require('rcon-client');

// ========== ТВОИ ДАННЫЕ ==========
const BOT_TOKEN = '8792137358:AAHMO9wKGVKvXgYsqOz5cSN43xdSpUzrknk';
const ADMIN_ID = '8579640456';
const RCON_HOST = process.env.RCON_HOST || '127.0.0.1';
const RCON_PORT = parseInt(process.env.RCON_PORT) || 7777;
const RCON_PASSWORD = process.env.RCON_PASSWORD || 'твой_пароль_rcon';

// ========== НАСТРОЙКА КИТОВ С ТВОИМИ ФОТО ==========
const KITS = {
    pvp: {
        id: 'pvp',
        name: '⚔️ PvP Kit',
        description: '✅ Броня + AK-47 + M4 + 50.000$',
        price: 20,
        emoji: '⚔️',
        image: 'https://i.postimg.cc/nX3mkwWg/file-1.jpg', // Твоё фото PvP
        command: '/givekit pvp'
    },
    pvp_plus: {
        id: 'pvp_plus',
        name: '🔥 PvP+ Kit',
        description: '✅ Броня + Миниган + Снайперка + 100.000$',
        price: 35,
        emoji: '🔥',
        image: 'https://i.postimg.cc/HrvJ58cY/file-2.jpg', // Твоё фото PvP+
        command: '/givekit pvpplus'
    },
    pvp_plusplus: {
        id: 'pvp_plusplus',
        name: '💀 PvP++ Kit',
        description: '✅ Броня + РПГ + Миниган + 250.000$ + Вип статус',
        price: 50,
        emoji: '💀',
        image: 'https://i.postimg.cc/CBkdWvvZ/file.jpg', // Твоё фото PvP++
        command: '/givekit pvpplusplus'
    }
};

// ========== ИНИЦИАЛИЗАЦИЯ БОТА ==========
const bot = new TelegramBot(BOT_TOKEN, { 
    polling: {
        interval: 300,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

console.log('🤖 Бот запущен!');
console.log(`👤 Админ: ${ADMIN_ID}`);
console.log(`📦 Китов: ${Object.keys(KITS).length}`);

// ========== ФУНКЦИЯ ОТПРАВКИ КОМАНДЫ НА СЕРВЕР ==========
async function sendCommandToServer(command, playerName) {
    try {
        const client = new Client({
            host: RCON_HOST,
            port: RCON_PORT,
            password: RCON_PASSWORD,
            timeout: 5000
        });
        
        await client.connect();
        const fullCommand = `${command} ${playerName}`;
        const response = await client.send(fullCommand);
        await client.end();
        
        console.log(`✅ RCON: ${fullCommand}`);
        console.log(`📥 Ответ: ${response}`);
        return true;
        
    } catch (error) {
        console.error(`❌ RCON ошибка: ${error.message}`);
        
        await bot.sendMessage(ADMIN_ID, 
            `⚠️ НЕ УДАЛОСЬ ВЫДАТЬ КИТ!\n` +
            `Игрок: ${playerName}\n` +
            `Команда: ${command} ${playerName}\n` +
            `Ошибка: ${error.message}`
        );
        
        return false;
    }
}

// ========== ГЛАВНОЕ МЕНЮ (/START) ==========
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'Игрок';
    
    const text = `🌟 <b>Добро пожаловать, ${firstName}!</b>\n\n` +
        `💎 <b>Магазин PvP Китов за Telegram Stars</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💰 <b>Пополни баланс звезд</b> и покупай крутые наборы!\n\n` +
        `📋 <b>Доступные наборы:</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️ PvP Kit — 20 ⭐\n` +
        `🔥 PvP+ Kit — 35 ⭐\n` +
        `💀 PvP++ Kit — 50 ⭐\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⬇️ <b>Нажми на кнопку ниже, чтобы выбрать кит</b>`;
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '⚔️ PvP Kit (20⭐)', callback_data: 'show_pvp' },
                    { text: '🔥 PvP+ Kit (35⭐)', callback_data: 'show_pvp_plus' }
                ],
                [
                    { text: '💀 PvP++ Kit (50⭐)', callback_data: 'show_pvp_plusplus' }
                ],
                [
                    { text: '📊 Мои покупки', callback_data: 'my_purchases' },
                    { text: '🆘 Помощь', callback_data: 'help' }
                ]
            ]
        }
    };
    
    bot.sendMessage(chatId, text, { 
        parse_mode: 'HTML',
        ...keyboard
    });
});

// ========== ПОКАЗ КИТА С ФОТО ==========
async function showKit(chatId, kitKey) {
    const kit = KITS[kitKey];
    if (!kit) return;
    
    const caption = `📦 <b>${kit.name}</b>\n\n` +
        `${kit.description}\n\n` +
        `💰 <b>Цена:</b> ${kit.price} ⭐\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⬇️ <b>Нажми кнопку "Купить" для оплаты</b>`;
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: `💎 Купить за ${kit.price} ⭐`, callback_data: `buy_${kitKey}` }
                ],
                [
                    { text: '⬅️ Назад в меню', callback_data: 'back_to_menu' }
                ]
            ]
        }
    };
    
    try {
        await bot.sendPhoto(chatId, kit.image, {
            caption: caption,
            parse_mode: 'HTML',
            ...keyboard
        });
    } catch (error) {
        console.error('Ошибка отправки фото:', error.message);
        await bot.sendMessage(chatId, 
            `📦 ${kit.name}\n\n${kit.description}\n\n💰 Цена: ${kit.price} ⭐`,
            keyboard
        );
    }
}

// ========== ОБРАБОТЧИК КНОПОК ==========
bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const messageId = callbackQuery.message.message_id;
    
    if (action === 'show_pvp') {
        await showKit(chatId, 'pvp');
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (action === 'show_pvp_plus') {
        await showKit(chatId, 'pvp_plus');
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (action === 'show_pvp_plusplus') {
        await showKit(chatId, 'pvp_plusplus');
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (action.startsWith('buy_')) {
        const kitKey = action.replace('buy_', '');
        const kit = KITS[kitKey];
        
        if (kit) {
            await createInvoice(chatId, userId, kit, kitKey);
        }
        
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (action === 'back_to_menu') {
        try {
            await bot.deleteMessage(chatId, messageId);
        } catch (e) {}
        
        const firstName = callbackQuery.from.first_name || 'Игрок';
        const text = `🌟 <b>Добро пожаловать, ${firstName}!</b>\n\n` +
            `💎 <b>Магазин PvP Китов за Telegram Stars</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `💰 <b>Пополни баланс звезд</b> и покупай крутые наборы!\n\n` +
            `📋 <b>Доступные наборы:</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `⚔️ PvP Kit — 20 ⭐\n` +
            `🔥 PvP+ Kit — 35 ⭐\n` +
            `💀 PvP++ Kit — 50 ⭐\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `⬇️ <b>Нажми на кнопку ниже, чтобы выбрать кит</b>`;
        
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '⚔️ PvP Kit (20⭐)', callback_data: 'show_pvp' },
                        { text: '🔥 PvP+ Kit (35⭐)', callback_data: 'show_pvp_plus' }
                    ],
                    [
                        { text: '💀 PvP++ Kit (50⭐)', callback_data: 'show_pvp_plusplus' }
                    ],
                    [
                        { text: '📊 Мои покупки', callback_data: 'my_purchases' },
                        { text: '🆘 Помощь', callback_data: 'help' }
                    ]
                ]
            }
        };
        
        await bot.sendMessage(chatId, text, { 
            parse_mode: 'HTML',
            ...keyboard
        });
        
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (action === 'my_purchases') {
        await bot.sendMessage(chatId, 
            `📊 <b>История покупок</b>\n\n` +
            `У тебя пока нет покупок.\n` +
            `Купи свой первый кит прямо сейчас! 💎\n\n` +
            `⬇️ Нажми на кнопку "Назад в меню"`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ Назад в меню', callback_data: 'back_to_menu' }]
                    ]
                }
            }
        );
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (action === 'help') {
        await bot.sendMessage(chatId, 
            `🆘 <b>Помощь</b>\n\n` +
            `1️⃣ Выбери кит из списка\n` +
            `2️⃣ Нажми "Купить" и оплати звездами\n` +
            `3️⃣ Получи набор на сервере!\n\n` +
            `📌 <b>Команды:</b>\n` +
            `/start - Главное меню\n` +
            `/kits - Все киты\n` +
            `/help - Эта справка\n\n` +
            `⚠️ Если набор не пришел - напиши админу!`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ Назад в меню', callback_data: 'back_to_menu' }]
                    ]
                }
            }
        );
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
});

// ========== ФУНКЦИЯ СОЗДАНИЯ ИНВОЙСА ==========
async function createInvoice(chatId, userId, kit, kitKey) {
    try {
        const invoice = {
            chat_id: chatId,
            title: kit.name,
            description: kit.description,
            payload: JSON.stringify({
                kit: kitKey,
                userId: userId,
                timestamp: Date.now()
            }),
            provider_token: '',
            currency: 'XTR',
            prices: [
                { label: kit.name, amount: kit.price }
            ],
            start_parameter: 'buy_' + kitKey,
            photo_url: kit.image,
            photo_size: 100,
            photo_width: 100,
            photo_height: 100,
            need_name: false,
            need_phone_number: false,
            need_email: false,
            need_shipping_address: false,
            is_flexible: false
        };
        
        await bot.sendInvoice(
            invoice.chat_id,
            invoice.title,
            invoice.description,
            invoice.payload,
            invoice.provider_token,
            invoice.currency,
            invoice.prices,
            {
                start_parameter: invoice.start_parameter,
                photo_url: invoice.photo_url,
                photo_size: invoice.photo_size,
                photo_width: invoice.photo_width,
                photo_height: invoice.photo_height,
                need_name: invoice.need_name,
                need_phone_number: invoice.need_phone_number,
                need_email: invoice.need_email,
                need_shipping_address: invoice.need_shipping_address,
                is_flexible: invoice.is_flexible
            }
        );
        
        console.log(`💰 Счет создан: ${kit.name} для пользователя ${userId}`);
        
    } catch (error) {
        console.error('❌ Ошибка создания инвойса:', error);
        await bot.sendMessage(chatId, 
            '❌ Ошибка создания платежа. Попробуй позже.'
        );
    }
}

// ========== КОМАНДА /KITS ==========
bot.onText(/\/kits/, (msg) => {
    const chatId = msg.chat.id;
    
    let text = `📦 <b>Все PvP Киты:</b>\n\n`;
    
    for (const [key, kit] of Object.entries(KITS)) {
        text += `${kit.emoji} <b>${kit.name}</b>\n`;
        text += `   💰 ${kit.price} ⭐\n`;
        text += `   📝 ${kit.description}\n`;
        text += `   ───────────────\n\n`;
    }
    
    text += `⬇️ <b>Нажми на кнопку чтобы купить</b>`;
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '⚔️ PvP Kit (20⭐)', callback_data: 'show_pvp' },
                    { text: '🔥 PvP+ Kit (35⭐)', callback_data: 'show_pvp_plus' }
                ],
                [
                    { text: '💀 PvP++ Kit (50⭐)', callback_data: 'show_pvp_plusplus' }
                ],
                [
                    { text: '⬅️ Назад в меню', callback_data: 'back_to_menu' }
                ]
            ]
        }
    };
    
    bot.sendMessage(chatId, text, { 
        parse_mode: 'HTML',
        ...keyboard
    });
});

// ========== КОМАНДА /HELP ==========
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId, 
        `🆘 <b>Помощь</b>\n\n` +
        `1️⃣ Выбери кит из списка\n` +
        `2️⃣ Нажми "Купить" и оплати звездами\n` +
        `3️⃣ Получи набор на сервере!\n\n` +
        `📌 <b>Команды:</b>\n` +
        `/start - Главное меню\n` +
        `/kits - Все киты\n` +
        `/help - Эта справка\n\n` +
        `⚠️ Если набор не пришел - напиши админу!`,
        { parse_mode: 'HTML' }
    );
});

// ========== ПОДТВЕРЖДЕНИЕ ПЛАТЕЖА ==========
bot.on('pre_checkout_query', async (query) => {
    try {
        await bot.answerPreCheckoutQuery(query.id, true, '✅ Оплата принята!');
        console.log(`✅ PreCheckout: ${query.from.username} - ${query.invoice_payload}`);
    } catch (error) {
        console.error('❌ PreCheckout ошибка:', error);
        await bot.answerPreCheckoutQuery(query.id, false, '❌ Ошибка оплаты');
    }
});

// ========== УСПЕШНАЯ ОПЛАТА ==========
bot.on('successful_payment', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    const payment = msg.successful_payment;
    
    try {
        const payload = JSON.parse(payment.payload);
        const kitKey = payload.kit;
        const kit = KITS[kitKey];
        
        if (!kit) {
            console.error('❌ Неизвестный кит:', kitKey);
            await bot.sendMessage(chatId, '❌ Ошибка: неизвестный кит. Обратись к админу.');
            return;
        }
        
        console.log(`💎 Успешная оплата:`);
        console.log(`   Игрок: ${username} (ID: ${userId})`);
        console.log(`   Кит: ${kit.name}`);
        console.log(`   Цена: ${payment.total_amount} ⭐`);
        console.log(`   ID платежа: ${payment.telegram_payment_charge_id}`);
        
        await bot.sendMessage(chatId, 
            `⏳ <b>Обработка платежа...</b>\n\n` +
            `📦 ${kit.emoji} ${kit.name}\n` +
            `💰 Списано: ${payment.total_amount} ⭐\n` +
            `👤 Игрок: ${username}\n\n` +
            `🔄 Выдача на сервер...`,
            { parse_mode: 'HTML' }
        );
        
        const success = await sendCommandToServer(kit.command, username);
        
        if (success) {
            await bot.sendMessage(chatId, 
                `✅ <b>Набор успешно выдан!</b>\n\n` +
                `📦 ${kit.emoji} ${kit.name}\n` +
                `👤 Игрок: ${username}\n` +
                `⭐ Списано: ${payment.total_amount}\n` +
                `🆔 Платеж: ${payment.telegram_payment_charge_id.slice(0, 10)}...\n\n` +
                `🎮 <b>Заходи на сервер и получай набор!</b>`,
                { parse_mode: 'HTML' }
            );
            
            await bot.sendMessage(ADMIN_ID, 
                `✅ <b>Успешная выдача!</b>\n\n` +
                `👤 Игрок: ${username} (ID: ${userId})\n` +
                `📦 Кит: ${kit.name}\n` +
                `⭐ Цена: ${payment.total_amount} звезд\n` +
                `🆔 Платеж: ${payment.telegram_payment_charge_id}\n` +
                `📅 Время: ${new Date().toLocaleString()}`,
                { parse_mode: 'HTML' }
            );
            
        } else {
            await bot.sendMessage(chatId, 
                `⚠️ <b>Ошибка выдачи набора!</b>\n\n` +
                `Деньги списаны (${payment.total_amount} ⭐), но набор не выдан.\n\n` +
                `📌 <b>Что делать?</b>\n` +
                `1️⃣ Напиши админу\n` +
                `2️⃣ Укажи ID платежа: ${payment.telegram_payment_charge_id}\n` +
                `3️⃣ Админ выдаст набор вручную\n\n` +
                `Приносим извинения за неудобства! 🙏`,
                { parse_mode: 'HTML' }
            );
            
            await bot.sendMessage(ADMIN_ID, 
                `🚨 <b>ОШИБКА ВЫДАЧИ КИТА!</b>\n\n` +
                `👤 Игрок: ${username} (ID: ${userId})\n` +
                `📦 Кит: ${kit.name}\n` +
                `⭐ Сумма: ${payment.total_amount} звезд\n` +
                `🆔 Платеж: ${payment.telegram_payment_charge_id}\n` +
                `📅 Время: ${new Date().toLocaleString()}\n\n` +
                `⚠️ <b>Нужно выдать вручную!</b>`,
                { parse_mode: 'HTML' }
            );
        }
        
    } catch (error) {
        console.error('❌ Ошибка обработки платежа:', error);
        await bot.sendMessage(chatId, 
            '❌ Произошла ошибка при обработке платежа.\n' +
            'Напиши админу и укажи ID платежа: ' + payment.telegram_payment_charge_id
        );
        
        await bot.sendMessage(ADMIN_ID, 
            `❌ КРИТИЧЕСКАЯ ОШИБКА!\n` +
            `Платеж: ${payment.telegram_payment_charge_id}\n` +
            `Ошибка: ${error.message}`
        );
    }
});

// ========== ЛОГИРОВАНИЕ ==========
bot.on('message', (msg) => {
    if (msg.text && !msg.text.startsWith('/')) {
        console.log(`💬 Сообщение от ${msg.from.username}: ${msg.text}`);
    }
});

// ========== ОБРАБОТЧИК ОШИБОК ==========
bot.on('polling_error', (error) => {
    console.error('❌ Ошибка поллинга:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Необработанное отклонение:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Непойманное исключение:', error);
});

console.log('✅ Бот успешно запущен!');
console.log('📋 Доступные команды:');
for (const [key, kit] of Object.entries(KITS)) {
    console.log(`   /${key} - ${kit.name} (${kit.price} ⭐)`);
}
console.log('━━━━━━━━━━━━━━━━━━━━━');