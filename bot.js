const { Telegraf, Markup, session } = require('telegraf');
const dotenv = require('dotenv');
dotenv.config();

const bot = new Telegraf(process.env.TOKEN);

// ===== Хранилища данных (в памяти) =====
const users = new Map(); // userId -> { balance, deals, verified, cards, tonWallets, totalDeals, successDeals, turnover }
const deals = new Map(); // dealId -> { id, role, currency, amount, links, buyerId, sellerId, status, createdAt }

// ===== Вспомогательные функции =====
function getUser(userId) {
  if (!users.has(userId)) {
    users.set(userId, {
      balance: 0,
      deals: [],
      verified: false,
      cards: [],
      tonWallets: [],
      totalDeals: 0,
      successDeals: 0,
      turnover: 0,
    });
  }
  return users.get(userId);
}

function generateDealId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '#';
  for (let i = 0; i < 10; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ===== Middleware сессии =====
bot.use(session());

// ===== Обработчик команды /start =====
bot.start(async (ctx) => {
  const payload = ctx.startPayload;
  // Если перешли по ссылке сделки
  if (payload && payload.startsWith('deal_')) {
    const dealId = payload.replace('deal_', '');
    const deal = deals.get(dealId);
    if (!deal) {
      await ctx.reply('❌ Сделка не найдена или уже закрыта.');
      return;
    }
    await ctx.reply(
      `📦 Вы перешли по ссылке сделки #${dealId}\n\n` +
      `Покупатель: @${ctx.from.username || 'unknown'}\n` +
      `Сумма: ${deal.amount} ${deal.currency}\n` +
      `Описание:\n${deal.links.join('\n')}\n\n` +
      `Хотите принять эту сделку?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Принять', `accept_${dealId}`)],
        [Markup.button.callback('❌ Отклонить', `reject_${dealId}`)],
      ])
    );
    return;
  }

  // Обычный старт
  const user = getUser(ctx.from.id);
  await ctx.reply(
    'Добро пожаловать в Gram Deals!\n\n' +
    'Сервис, обеспечивающий безопасность и удобство проведения сделок с цифровыми подарками.\n\n' +
    '🔒 Сервис спонсирован: @gram\n' +
    '📧 Поддержка: @AgentNFTDeals\n\n' +
    'Начните работу, нажав кнопку ниже',
    Markup.inlineKeyboard([
      [Markup.button.callback('Начать работу', 'main_menu')]
    ])
  );
});

// ===== Главное меню =====
bot.action('main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await showMainMenu(ctx);
});

async function showMainMenu(ctx) {
  await ctx.reply(
    '🏠 Главное меню',
    Markup.inlineKeyboard([
      [Markup.button.callback('👤 Профиль', 'profile')],
      [Markup.button.callback('➕ Создать сделку', 'create_deal')],
      [Markup.button.callback('📋 Мои сделки', 'my_deals')],
      [Markup.button.callback('💳 Управление реквизитами', 'rekvizity')],
    ])
  );
}

// ===== Профиль =====
bot.action('profile', async (ctx) => {
  await ctx.answerCbQuery();
  const user = getUser(ctx.from.id);
  const text =
    `👤 Профиль пользователя\n\n` +
    `Юзер: @${ctx.from.username || 'нет'}\n` +
    `ID: ${ctx.from.id}\n\n` +
    `Баланс:\n${user.balance} ₽\n\n` +
    `Статистика:\nВсего сделок: ${user.totalDeals}\n` +
    `Успешных: ${user.successDeals}\n` +
    `Оборот: ${user.turnover} ₽\n\n` +
    `Верификация: ${user.verified ? '✅ Пройдена' : '⚙️ Не пройдена'}\n\n` +
    `Поддержка: @AgentNFTDeals`;
  await ctx.reply(text, Markup.inlineKeyboard([
    [Markup.button.callback('💰 Пополнить', 'deposit')],
    [Markup.button.callback('💸 Вывод', 'withdraw')],
    [Markup.button.callback('🎫 Промокод', 'promo')],
    [Markup.button.callback('🔙 Назад', 'main_menu')],
  ]));
});

bot.action('deposit', async (ctx) => {
  await ctx.answerCbQuery('Функция в разработке');
});
bot.action('withdraw', async (ctx) => {
  await ctx.answerCbQuery('Функция в разработке');
});
bot.action('promo', async (ctx) => {
  await ctx.answerCbQuery('Функция в разработке');
});

// ===== Создание сделки – выбор роли =====
bot.action('create_deal', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    'Выберите роль в сделке:',
    Markup.inlineKeyboard([
      [Markup.button.callback('🛒 Покупатель', 'role_buyer')],
      [Markup.button.callback('📦 Продавец', 'role_seller')],
      [Markup.button.callback('← В меню', 'main_menu')],
    ])
  );
});

// ===== Роль Покупатель =====
bot.action('role_buyer', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.deal = { role: 'buyer', step: 'links' };
  await ctx.reply(
    '🛒 Создание сделки | Покупатель\n\n' +
    'Введите ссылку(-и) на подарок(-и):\n' +
    '- Формат: https://... или t.me/...\n' +
    '- Пример: t.me/nft/DurovsCap-1\n\n' +
    'Если несколько подарков:\n' +
    'Каждую ссылку с новой строки:\n' +
    't.me/nft/DurovsCap-1\n' +
    't.me/nft/PlushPepe-2\n' +
    't.me/nft/EternalRose-3',
    Markup.inlineKeyboard([
      [Markup.button.callback('◀ Назад', 'create_deal')]
    ])
  );
  ctx.session.awaiting = 'buyer_links';
});

// ===== Обработка ввода ссылок =====
bot.on('text', async (ctx) => {
  if (ctx.session.awaiting === 'buyer_links') {
    const links = ctx.message.text.split('\n').filter(s => s.trim());
    if (links.length === 0) {
      await ctx.reply('Введите хотя бы одну ссылку.');
      return;
    }
    ctx.session.deal.links = links;
    ctx.session.awaiting = null;
    await showCurrencySelection(ctx);
  } else if (ctx.session.awaiting === 'buyer_currency') {
    // Обрабатывается через callback
  } else if (ctx.session.awaiting === 'buyer_amount') {
    const amount = parseFloat(ctx.message.text.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('Введите корректное число');
      return;
    }
    ctx.session.deal.amount = amount;
    ctx.session.awaiting = null;
    await showDealConfirmation(ctx);
  } else if (ctx.session.awaiting === 'add_card') {
    const text = ctx.message.text;
    if (!text.includes('-')) {
      await ctx.reply('Неверный формат. Используйте: Банк - Номер карты');
      return;
    }
    const user = getUser(ctx.from.id);
    user.cards.push(text);
    ctx.session.awaiting = null;
    await ctx.reply('✅ Карта успешно добавлена!', Markup.inlineKeyboard([
      [Markup.button.callback('← Назад', 'rekvizity')]
    ]));
  } else if (ctx.session.awaiting === 'add_ton') {
    const text = ctx.message.text.trim();
    if (!text.startsWith('UQ') && !text.startsWith('EQ')) {
      await ctx.reply('Неверный адрес TON. Попробуйте снова.');
      return;
    }
    const user = getUser(ctx.from.id);
    user.tonWallets.push(text);
    ctx.session.awaiting = null;
    await ctx.reply('✅ TON кошелек успешно добавлен!', Markup.inlineKeyboard([
      [Markup.button.callback('← Назад', 'rekvizity')]
    ]));
  } else {
    // Если сообщение не ожидалось – предлагаем использовать кнопки
    if (ctx.message && ctx.message.text) {
      await ctx.reply('Пожалуйста, используйте кнопки для навигации.');
    }
  }
});

// ===== Выбор валюты =====
async function showCurrencySelection(ctx) {
  const currencyKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('RUB', 'currency_RUB'), Markup.button.callback('EUR', 'currency_EUR')],
    [Markup.button.callback('UZS', 'currency_UZS'), Markup.button.callback('KGS', 'currency_KGS')],
    [Markup.button.callback('KZT', 'currency_KZT'), Markup.button.callback('Stars', 'currency_Stars')],
    [Markup.button.callback('UAH', 'currency_UAH'), Markup.button.callback('BYN', 'currency_BYN')],
    [Markup.button.callback('USDT', 'currency_USDT'), Markup.button.callback('GRAM', 'currency_GRAM')],
    [Markup.button.callback('← Назад', 'create_deal')],
  ]);
  await ctx.reply('Выберите валюту:', currencyKeyboard);
  ctx.session.awaiting = 'buyer_currency';
}

bot.action(/currency_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const currency = ctx.match[1];
  ctx.session.deal.currency = currency;
  ctx.session.awaiting = null;
  await ctx.reply(
    `Введите сумму в ${currency}:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('← Назад', 'create_deal')]
    ])
  );
  ctx.session.awaiting = 'buyer_amount';
});

// ===== Подтверждение и создание сделки =====
async function showDealConfirmation(ctx) {
  const deal = ctx.session.deal;
  const linksText = deal.links.join('\n');
  const dealId = generateDealId();

  // Сохраняем сделку
  const newDeal = {
    id: dealId,
    role: deal.role,
    currency: deal.currency,
    amount: deal.amount,
    links: deal.links,
    buyerId: ctx.from.id,
    sellerId: null,
    status: 'open',
    createdAt: new Date(),
  };
  deals.set(dealId, newDeal);

  // Обновляем статистику пользователя
  const user = getUser(ctx.from.id);
  user.totalDeals += 1;
  user.turnover += deal.amount;

  const sellerLink = `https://t.me/${ctx.botInfo.username}?start=deal_${dealId}`;

  let replyText =
    `✅ Сделка создана!\n\n` +
    `ID сделки: ${dealId}\n` +
    `Ваша роль: Покупатель\n` +
    `Сумма: ${deal.amount} ${deal.currency}\n` +
    `Описание:\n${linksText}\n\n` +
    `Ссылка для продавца:\n${sellerLink}\n\n` +
    `Поддержка: @AgentNFTDeals\n\n` +
    `Telegram\nDurov's Cap #1\nПОКАЗАТЬ ПОДАРОК`;

  await ctx.reply(replyText, Markup.inlineKeyboard([
    [Markup.button.url('ПОКАЗАТЬ ПОДАРОК', deal.links[0])]
  ]));

  ctx.session.deal = null;
  ctx.session.awaiting = null;
}

// ===== Роль Продавец (упрощённо) =====
bot.action('role_seller', async (ctx) => {
  await ctx.answerCbQuery('Функция для продавца в разработке');
  // Здесь можно реализовать аналогичный поток для продавца
});

// ===== Мои сделки =====
bot.action('my_deals', async (ctx) => {
  await ctx.answerCbQuery();
  const user = getUser(ctx.from.id);
  await ctx.reply(`📋 У вас ${user.totalDeals} сделок.`, Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Назад', 'main_menu')]
  ]));
});

// ===== Управление реквизитами =====
bot.action('rekvizity', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '💳 Управление реквизитами\n\nВыберите опцию:',
    Markup.inlineKeyboard([
      [Markup.button.callback('☐ Добавить карту', 'add_card')],
      [Markup.button.callback('☐ Добавить TON', 'add_ton')],
      [Markup.button.callback('☐ Посмотреть реквизиты', 'view_rekvizity')],
      [Markup.button.callback('← Назад', 'main_menu')],
    ])
  );
});

bot.action('add_card', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.awaiting = 'add_card';
  await ctx.reply(
    '💳 Добавить банковскую карту\n\n' +
    'Формат: Банк - Номер карты\n' +
    'Пример: Сбербанк - 1234 5678 9012 3456\n\n' +
    'Отправьте реквизиты одним сообщением:',
    Markup.inlineKeyboard([
      [Markup.button.callback('← Назад', 'rekvizity')]
    ])
  );
});

bot.action('add_ton', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.awaiting = 'add_ton';
  await ctx.reply(
    '💎 Добавить TON кошелек\n\n' +
    'Пример адреса:\n' +
    'UQAY6fREx6M7QsnCkUJKNptZdRG-Q_1kW2FAa2Am-aBJ5-7X\n\n' +
    'Отправьте адрес вашего TON кошелька:',
    Markup.inlineKeyboard([
      [Markup.button.callback('← Назад', 'rekvizity')]
    ])
  );
});

bot.action('view_rekvizity', async (ctx) => {
  await ctx.answerCbQuery();
  const user = getUser(ctx.from.id);
  let text = '📋 Ваши реквизиты:\n\n';
  if (user.cards.length) {
    text += '💳 Карты:\n' + user.cards.map(c => `- ${c}`).join('\n') + '\n\n';
  } else {
    text += '💳 Карты: нет\n\n';
  }
  if (user.tonWallets.length) {
    text += '💎 TON кошельки:\n' + user.tonWallets.map(w => `- ${w}`).join('\n') + '\n\n';
  } else {
    text += '💎 TON кошельки: нет\n\n';
  }
  await ctx.reply(text, Markup.inlineKeyboard([
    [Markup.button.callback('← Назад', 'rekvizity')]
  ]));
});

// ===== Обработка принятия/отклонения сделки продавцом =====
bot.action(/accept_(.+)/, async (ctx) => {
  const dealId = ctx.match[1];
  const deal = deals.get(dealId);
  if (!deal) {
    await ctx.answerCbQuery('❌ Сделка не найдена');
    return;
  }
  deal.sellerId = ctx.from.id;
  deal.status = 'active';
  await ctx.answerCbQuery('✅ Сделка принята!');
  await ctx.reply(`✅ Сделка #${dealId} принята. Теперь свяжитесь с покупателем для обмена.`);
  // Здесь можно уведомить покупателя
});

bot.action(/reject_(.+)/, async (ctx) => {
  const dealId = ctx.match[1];
  const deal = deals.get(dealId);
  if (!deal) {
    await ctx.answerCbQuery('❌ Сделка не найдена');
    return;
  }
  deal.status = 'rejected';
  await ctx.answerCbQuery('❌ Сделка отклонена');
  await ctx.reply(`❌ Вы отклонили сделку #${dealId}.`);
});

// ===== Запуск бота =====
bot.launch();
console.log('✅ Бот запущен');
