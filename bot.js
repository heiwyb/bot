const { Telegraf, Markup, session } = require('telegraf');
const dotenv = require('dotenv');
dotenv.config();

const bot = new Telegraf(process.env.TOKEN);
const BOT_USERNAME = 'Nnft_Dealsbot';  // ← Имя вашего бота (без @)

// ===== Хранилища данных =====
const users = new Map();
const deals = new Map();

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

// Генерирует ID без символа '#'
function generateDealId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 10; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// Отображает ID с символом '#' для пользователя
function displayDealId(id) {
  return `#${id}`;
}

function resetSession(ctx) {
  if (ctx.session) {
    ctx.session.deal = null;
    ctx.session.awaiting = null;
  }
}

// ===== Сессия с инициализацией =====
bot.use(session({
  defaultSession: () => ({ deal: null, awaiting: null })
}));

// ============================================================
//  СТАРТ
// ============================================================
bot.start(async (ctx) => {
  if (!ctx.session) ctx.session = { deal: null, awaiting: null };

  const payload = ctx.startPayload;
  if (payload && payload.startsWith('deal_')) {
    const dealId = payload.replace('deal_', ''); // теперь без '#'
    const deal = deals.get(dealId);
    if (!deal) {
      await ctx.reply('❌ Сделка не найдена или уже закрыта.');
      return;
    }
    if (deal.status !== 'open') {
      await ctx.reply('❌ Эта сделка уже неактивна.');
      return;
    }

    // Определяем создателя
    let creatorRole, creatorId;
    if (deal.buyerId) {
      creatorRole = 'Покупатель';
      creatorId = deal.buyerId;
    } else if (deal.sellerId) {
      creatorRole = 'Продавец';
      creatorId = deal.sellerId;
    } else {
      await ctx.reply('❌ Ошибка: неизвестный создатель сделки.');
      return;
    }

    if (ctx.from.id === creatorId) {
      await ctx.reply('⚠️ Вы создали эту сделку. Ожидайте, пока другая сторона примет её.');
      return;
    }

    await ctx.reply(
      `📦 Вы перешли по ссылке сделки ${displayDealId(dealId)}\n\n` +
      `${creatorRole}: @${ctx.from.username || 'unknown'}\n` +
      `Сумма: ${deal.amount} ${deal.currency}\n` +
      `Товар:\n${deal.links.join('\n')}\n\n` +
      `Хотите принять эту сделку?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Принять', `accept_${dealId}`)],
        [Markup.button.callback('❌ Отклонить', `reject_${dealId}`)],
      ])
    );
    return;
  }

  // Обычный старт
  getUser(ctx.from.id);
  resetSession(ctx);
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

// ============================================================
//  ГЛАВНОЕ МЕНЮ
// ============================================================
bot.action('main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  resetSession(ctx);
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

// ============================================================
//  ПРОФИЛЬ
// ============================================================
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

bot.action('deposit', async (ctx) => ctx.answerCbQuery('Функция в разработке'));
bot.action('withdraw', async (ctx) => ctx.answerCbQuery('Функция в разработке'));
bot.action('promo', async (ctx) => ctx.answerCbQuery('Функция в разработке'));

// ============================================================
//  ВЫБОР РОЛИ ДЛЯ СОЗДАНИЯ СДЕЛКИ
// ============================================================
bot.action('create_deal', async (ctx) => {
  await ctx.answerCbQuery();
  resetSession(ctx);
  await ctx.reply(
    'Выберите роль в сделке:',
    Markup.inlineKeyboard([
      [Markup.button.callback('🛒 Покупатель', 'role_buyer')],
      [Markup.button.callback('📦 Продавец', 'role_seller')],
      [Markup.button.callback('← В меню', 'main_menu')],
    ])
  );
});

// Общая функция для начала создания сделки
async function startDealCreation(ctx, role) {
  ctx.session.deal = { role };
  await ctx.reply(
    `📝 Создание сделки | ${role === 'buyer' ? 'Покупатель' : 'Продавец'}\n\n` +
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
  ctx.session.awaiting = 'deal_links';
}

bot.action('role_buyer', async (ctx) => {
  await ctx.answerCbQuery();
  await startDealCreation(ctx, 'buyer');
});

bot.action('role_seller', async (ctx) => {
  await ctx.answerCbQuery();
  await startDealCreation(ctx, 'seller');
});

// ============================================================
//  ОБРАБОТЧИК ТЕКСТОВЫХ СООБЩЕНИЙ
// ============================================================
bot.on('text', async (ctx) => {
  if (!ctx.session) ctx.session = { deal: null, awaiting: null };

  const awaiting = ctx.session.awaiting;
  const text = ctx.message.text.trim();

  if (!awaiting) {
    await ctx.reply('Пожалуйста, используйте кнопки для навигации.');
    return;
  }

  // === Ввод ссылок ===
  if (awaiting === 'deal_links') {
    const links = text.split('\n').filter(s => s.trim());
    if (links.length === 0) {
      await ctx.reply('❌ Введите хотя бы одну ссылку.');
      return;
    }
    ctx.session.deal.links = links;
    ctx.session.awaiting = null;
    await showCurrencySelection(ctx);
    return;
  }

  // === Ввод суммы ===
  if (awaiting === 'deal_amount') {
    const amount = parseFloat(text.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Введите корректное число');
      return;
    }
    ctx.session.deal.amount = amount;
    ctx.session.awaiting = null;
    await createDeal(ctx);
    return;
  }

  // === Добавление карты ===
  if (awaiting === 'add_card') {
    if (!text.includes('-')) {
      await ctx.reply('❌ Неверный формат. Используйте: Банк - Номер карты');
      return;
    }
    const user = getUser(ctx.from.id);
    user.cards.push(text);
    ctx.session.awaiting = null;
    await ctx.reply('✅ Карта успешно добавлена!', Markup.inlineKeyboard([
      [Markup.button.callback('← Назад', 'rekvizity')]
    ]));
    return;
  }

  // === Добавление TON ===
  if (awaiting === 'add_ton') {
    if (!text.startsWith('UQ') && !text.startsWith('EQ')) {
      await ctx.reply('❌ Неверный адрес TON. Адрес должен начинаться с UQ или EQ.');
      return;
    }
    const user = getUser(ctx.from.id);
    user.tonWallets.push(text);
    ctx.session.awaiting = null;
    await ctx.reply('✅ TON кошелек успешно добавлен!', Markup.inlineKeyboard([
      [Markup.button.callback('← Назад', 'rekvizity')]
    ]));
    return;
  }

  await ctx.reply('Неизвестная команда. Используйте кнопки.');
});

// ============================================================
//  ВЫБОР ВАЛЮТЫ
// ============================================================
async function showCurrencySelection(ctx) {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('RUB', 'currency_RUB'), Markup.button.callback('EUR', 'currency_EUR')],
    [Markup.button.callback('UZS', 'currency_UZS'), Markup.button.callback('KGS', 'currency_KGS')],
    [Markup.button.callback('KZT', 'currency_KZT'), Markup.button.callback('Stars', 'currency_Stars')],
    [Markup.button.callback('UAH', 'currency_UAH'), Markup.button.callback('BYN', 'currency_BYN')],
    [Markup.button.callback('USDT', 'currency_USDT'), Markup.button.callback('GRAM', 'currency_GRAM')],
    [Markup.button.callback('← Назад', 'create_deal')],
  ]);
  await ctx.reply('Выберите валюту:', keyboard);
  ctx.session.awaiting = 'deal_currency';
}

bot.action(/currency_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const currency = ctx.match[1];
  if (!ctx.session.deal) ctx.session.deal = {};
  ctx.session.deal.currency = currency;
  ctx.session.awaiting = null;
  await ctx.reply(
    `Введите сумму в ${currency}:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('← Назад', 'create_deal')]
    ])
  );
  ctx.session.awaiting = 'deal_amount';
});

// ============================================================
//  СОЗДАНИЕ СДЕЛКИ
// ============================================================
async function createDeal(ctx) {
  const dealData = ctx.session.deal;
  if (!dealData || !dealData.links || !dealData.currency || !dealData.amount) {
    await ctx.reply('❌ Ошибка: не все данные заполнены. Попробуйте заново.');
    resetSession(ctx);
    return;
  }

  const dealId = generateDealId();  // без '#'
  const newDeal = {
    id: dealId,
    role: dealData.role,
    currency: dealData.currency,
    amount: dealData.amount,
    links: dealData.links,
    buyerId: dealData.role === 'buyer' ? ctx.from.id : null,
    sellerId: dealData.role === 'seller' ? ctx.from.id : null,
    status: 'open',
    createdAt: new Date(),
  };
  deals.set(dealId, newDeal);

  const user = getUser(ctx.from.id);
  user.totalDeals += 1;
  user.turnover += dealData.amount;

  const roleName = dealData.role === 'buyer' ? 'Покупатель' : 'Продавец';
  const oppositeRole = dealData.role === 'buyer' ? 'продавца' : 'покупателя';
  const link = `https://t.me/${BOT_USERNAME}?start=deal_${dealId}`;

  let replyText =
    `✅ Сделка создана!\n\n` +
    `ID сделки: ${displayDealId(dealId)}\n` +
    `Ваша роль: ${roleName}\n` +
    `Сумма: ${dealData.amount} ${dealData.currency}\n` +
    `Описание:\n${dealData.links.join('\n')}\n\n` +
    `Ссылка для ${oppositeRole}:\n${link}\n\n` +
    `Поддержка: @AgentNFTDeals`;

  await ctx.reply(replyText, Markup.inlineKeyboard([
    [Markup.button.url('ПОКАЗАТЬ ПОДАРОК', dealData.links[0])]
  ]));

  resetSession(ctx);
}

// ============================================================
//  МОИ СДЕЛКИ
// ============================================================
bot.action('my_deals', async (ctx) => {
  await ctx.answerCbQuery();
  const user = getUser(ctx.from.id);
  await ctx.reply(`📋 У вас ${user.totalDeals} сделок.`, Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Назад', 'main_menu')]
  ]));
});

// ============================================================
//  УПРАВЛЕНИЕ РЕКВИЗИТАМИ
// ============================================================
bot.action('rekvizity', async (ctx) => {
  await ctx.answerCbQuery();
  resetSession(ctx);
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
    'UQAY6fREx6M7QsnCkUJKNPtZdRG-Q_1kW2FAa2Am-aBJ5-7X\n\n' +
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

// ============================================================
//  ПРИНЯТИЕ / ОТКЛОНЕНИЕ СДЕЛКИ
// ============================================================
bot.action(/accept_(.+)/, async (ctx) => {
  const dealId = ctx.match[1]; // без '#'
  const deal = deals.get(dealId);
  if (!deal) {
    await ctx.answerCbQuery('❌ Сделка не найдена');
    return;
  }
  if (deal.status !== 'open') {
    await ctx.answerCbQuery('❌ Сделка уже закрыта');
    return;
  }

  // Нельзя принять свою сделку
  if (deal.buyerId && deal.buyerId === ctx.from.id) {
    await ctx.answerCbQuery('❌ Вы не можете принять свою собственную сделку как покупатель');
    return;
  }
  if (deal.sellerId && deal.sellerId === ctx.from.id) {
    await ctx.answerCbQuery('❌ Вы не можете принять свою собственную сделку как продавец');
    return;
  }

  // Заполняем недостающую сторону
  if (deal.buyerId && !deal.sellerId) {
    deal.sellerId = ctx.from.id;
  } else if (deal.sellerId && !deal.buyerId) {
    deal.buyerId = ctx.from.id;
  } else {
    await ctx.answerCbQuery('❌ Неизвестная ошибка');
    return;
  }

  deal.status = 'active';
  await ctx.answerCbQuery('✅ Сделка принята!');
  await ctx.reply(`✅ Сделка ${displayDealId(dealId)} принята. Теперь свяжитесь с другой стороной для обмена.`);
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
  await ctx.reply(`❌ Вы отклонили сделку ${displayDealId(dealId)}.`);
});

// ============================================================
//  ЗАПУСК БОТА
// ============================================================
bot.launch().then(() => {
  console.log('✅ Бот успешно запущен');
}).catch(err => {
  console.error('❌ Ошибка запуска:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
