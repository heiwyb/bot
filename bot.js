require('dotenv').config({ path: __dirname + '/.env' });

const { Telegraf, Markup, session } = require('telegraf');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// ------------------ ПРОВЕРКА ТОКЕНА ------------------
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('❌ Токен не найден в .env!');
  process.exit(1);
}
console.log('✅ Токен загружен');

// ------------------ ИНИЦИАЛИЗАЦИЯ БОТА ------------------
const bot = new Telegraf(TOKEN);

// ------------------ УДАЛЕНИЕ WEBHOOK С ОЖИДАНИЕМ ------------------
(async () => {
  try {
    const result = await bot.telegram.deleteWebhook();
    console.log('✅ Webhook удалён:', result);
  } catch (err) {
    console.error('⚠️ Ошибка удаления webhook:', err.message);
  }
})();

// ------------------ ЛОГИРОВАНИЕ ------------------
bot.use(async (ctx, next) => {
  const type = ctx.updateType;
  let data = '';
  if (type === 'message') data = ctx.message.text || '[не текст]';
  else if (type === 'callback_query') data = ctx.callbackQuery.data;
  console.log(`[${new Date().toISOString()}] От ${ctx.from?.id} (${type}): ${data}`);
  await next();
});

// ------------------ ХРАНИЛИЩЕ ------------------
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEALS_FILE = path.join(DATA_DIR, 'deals.json');
const REQUISITES_FILE = path.join(DATA_DIR, 'requisites.json');

function loadData(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}
function saveData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
if (!fs.existsSync(USERS_FILE)) saveData(USERS_FILE, {});
if (!fs.existsSync(DEALS_FILE)) saveData(DEALS_FILE, {});
if (!fs.existsSync(REQUISITES_FILE)) saveData(REQUISITES_FILE, {});

// ------------------ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ------------------
function getUser(userId) {
  const users = loadData(USERS_FILE);
  if (!users[userId]) {
    users[userId] = {
      id: userId,
      username: null,
      balance: 0,
      stats: { total: 0, successful: 0, turnover: 0 },
      verified: false,
    };
    saveData(USERS_FILE, users);
  }
  return users[userId];
}

function updateUser(userId, data) {
  const users = loadData(USERS_FILE);
  users[userId] = { ...users[userId], ...data };
  saveData(USERS_FILE, users);
}

function getDeal(dealId) {
  const deals = loadData(DEALS_FILE);
  return deals[dealId] || null;
}

function saveDeal(deal) {
  const deals = loadData(DEALS_FILE);
  deals[deal.id] = deal;
  saveData(DEALS_FILE, deals);
}

function getUserDeals(userId) {
  const deals = loadData(DEALS_FILE);
  return Object.values(deals).filter(d => d.buyerId === userId || d.sellerId === userId);
}

function getRequisites(userId) {
  const reqs = loadData(REQUISITES_FILE);
  return reqs[userId] || { cards: [], tonWallets: [] };
}

function saveRequisites(userId, reqs) {
  const all = loadData(REQUISITES_FILE);
  all[userId] = reqs;
  saveData(REQUISITES_FILE, all);
}

function generateDealId() {
  return '#' + uuidv4().slice(0, 10);
}

// ------------------ СЕССИИ ------------------
bot.use(session({
  defaultSession: () => ({
    step: 'idle',
    data: {}
  })
}));

// ------------------ КЛАВИАТУРЫ ------------------
const mainMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('➕ Создать сделку', 'create_deal')],
  [Markup.button.callback('👤 Профиль', 'profile')],
  [Markup.button.callback('💳 Реквизиты', 'requisites')],
  [Markup.button.callback('🔗 Рефералы', 'referrals')],
  [Markup.button.callback('📜 История сделок', 'history')],
  [Markup.button.callback('🆘 Поддержка', 'support')]
]);

const backToMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🔙 Назад', 'main_menu')]
]);

const roleKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🛒 Покупатель', 'role_buyer')],
  [Markup.button.callback('💼 Продавец', 'role_seller')],
  [Markup.button.callback('🔙 В меню', 'main_menu')]
]);

const currencyKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('RUB', 'cur_RUB'), Markup.button.callback('EUR', 'cur_EUR')],
  [Markup.button.callback('UZS', 'cur_UZS'), Markup.button.callback('KGS', 'cur_KGS')],
  [Markup.button.callback('KZT', 'cur_KZT'), Markup.button.callback('UAH', 'cur_UAH')],
  [Markup.button.callback('BYN', 'cur_BYN'), Markup.button.callback('USDT', 'cur_USDT')],
  [Markup.button.callback('Stars', 'cur_Stars'), Markup.button.callback('GRAM', 'cur_GRAM')],
  [Markup.button.callback('🔙 Назад', 'create_deal')]
]);

const profileKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('💰 Пополнить', 'topup'), Markup.button.callback('💸 Вывод', 'withdraw')],
  [Markup.button.callback('🎫 Промокод', 'promo')],
  [Markup.button.callback('🔙 Назад', 'main_menu')]
]);

const requisitesMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('➕ Добавить карту', 'add_card')],
  [Markup.button.callback('➕ Добавить TON', 'add_ton')],
  [Markup.button.callback('👁 Посмотреть реквизиты', 'view_requisites')],
  [Markup.button.callback('🔙 Назад', 'main_menu')]
]);

// ------------------ КОМАНДА /CANCEL ------------------
bot.command('cancel', async (ctx) => {
  ctx.session.step = 'idle';
  ctx.session.data = {};
  await ctx.reply('✅ Действие отменено.', { ...backToMenuKeyboard });
});

// ------------------ /START ------------------
bot.start(async (ctx) => {
  console.log('✅ /start от', ctx.from.id);
  const text = ctx.message.text;
  const parts = text.split(' ');
  const userId = ctx.from.id;

  if (parts.length > 1 && parts[1].startsWith('deal_')) {
    const dealId = parts[1].replace('deal_', '');
    const deal = getDeal(dealId);
    if (!deal) return ctx.reply('❌ Сделка не найдена.');
    if (deal.buyerId === userId || deal.sellerId === userId) return ctx.reply('✅ Вы уже участник.');
    if (!deal.sellerId) {
      deal.sellerId = userId;
      deal.sellerUsername = ctx.from.username || `user${userId}`;
      saveDeal(deal);
      try { await bot.telegram.sendMessage(deal.buyerId, `✅ Продавец @${deal.sellerUsername} присоединился к сделке #${deal.id}`); } catch {}
      return ctx.reply(
        `✅ Вы присоединились к сделке #${deal.id}.\nСсылки: ${deal.links.join('\n')}\nСумма: ${deal.amount} ${deal.currency}`,
        Markup.inlineKeyboard([
          [Markup.button.url('📦 Показать подарок', deal.links[0])],
          [Markup.button.callback('✅ Завершить сделку', `complete_deal_${deal.id}`)]
        ])
      );
    } else return ctx.reply('❌ У сделки уже есть продавец.');
  }

  const user = getUser(userId);
  user.username = ctx.from.username || `user${userId}`;
  updateUser(userId, { username: user.username });

  ctx.replyWithHTML(
    `Добро пожаловать в <b>Gram Deals</b>!\n\nСервис для безопасных сделок с цифровыми подарками.\n\n🔒 Сервис спонсирован: @gram\n📧 Поддержка: @AgentNFTDeals\n\n✔️ Начните работу, нажав кнопку ниже.`,
    Markup.inlineKeyboard([[Markup.button.callback('🚀 Начать работу', 'main_menu')]])
  );
});

// ------------------ CALLBACK'И ------------------
bot.action('main_menu', async (ctx) => {
  ctx.session.step = 'idle';
  ctx.session.data = {};
  await ctx.editMessageText(
    `<b>Gram Deals</b>\n\n✅ Гарантируем конфиденциальность и безопасность.\n✅ Проект работает с момента переименования TON в GRAM.\n✅ Поддержка 24/7.\n\n<b>Выберите раздел:</b>`,
    { parse_mode: 'HTML', ...mainMenuKeyboard }
  );
});

bot.action('create_deal', async (ctx) => {
  ctx.session.step = 'create_deal_role';
  ctx.session.data = {};
  await ctx.editMessageText('Выберите роль в сделке:', { ...roleKeyboard });
});

bot.action(/^role_(buyer|seller)$/, async (ctx) => {
  const role = ctx.match[1];
  ctx.session.data.role = role;
  ctx.session.step = 'create_deal_links';
  await ctx.editMessageText(
    role === 'buyer'
      ? 'Создание сделки | Покупатель\n\nВведите ссылку(-и) на подарок(-и):\nФормат: https://... или t.me/...\nПример: t.me/nft/DurovsCap-1\n\nКаждая ссылка с новой строки:'
      : 'Создание сделки | Продавец\n\nВведите ссылку(-и) на подарок(-и) (каждая с новой строки):',
    Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'create_deal')]])
  );
});

bot.hears(/^https?:\/\/|t\.me\//, async (ctx) => {
  if (ctx.session.step !== 'create_deal_links') return;
  const links = ctx.message.text.split('\n').filter(l => l.trim());
  if (!links.length) return ctx.reply('❌ Введите хотя бы одну ссылку.');
  ctx.session.data.links = links;
  ctx.session.step = 'create_deal_currency';
  await ctx.reply('Выберите валюту:', { ...currencyKeyboard });
});

bot.action(/^cur_(.+)$/, async (ctx) => {
  const currency = ctx.match[1];
  ctx.session.data.currency = currency;
  ctx.session.step = 'create_deal_amount';
  await ctx.editMessageText('Введите сумму (число):', Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'create_deal')]]));
});

// ================== ОСНОВНОЙ ОБРАБОТЧИК ТЕКСТА ==================
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const step = ctx.session.step;
  console.log(`📝 Текст от ${ctx.from.id}, шаг: ${step}, текст: "${text}"`);

  // ----- ВВОД СУММЫ -----
  if (step === 'create_deal_amount') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('❌ Введите корректное число (больше 0).');
    }
    const { role, links, currency } = ctx.session.data;
    if (!role || !links || !currency) {
      ctx.session.step = 'idle';
      return ctx.reply('⚠️ Ошибка данных. Начните заново.', { ...backToMenuKeyboard });
    }

    const userId = ctx.from.id;
    const user = getUser(userId);
    const dealId = generateDealId();
    const deal = {
      id: dealId,
      buyerId: role === 'buyer' ? userId : null,
      sellerId: role === 'seller' ? userId : null,
      buyerUsername: role === 'buyer' ? ctx.from.username || `user${userId}` : null,
      sellerUsername: role === 'seller' ? ctx.from.username || `user${userId}` : null,
      links, amount, currency,
      status: 'active',
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    saveDeal(deal);
    user.stats.total += 1;
    updateUser(userId, { stats: user.stats });

    ctx.session.step = 'idle';
    ctx.session.data = {};

    const roleText = role === 'buyer' ? 'Покупатель' : 'Продавец';
    const shareLink = `https://t.me/${ctx.botInfo.username}?start=deal_${dealId}`;
    const inviteText = role === 'buyer'
      ? `Ссылка для продавца:\n${shareLink}`
      : `Ссылка для покупателя:\n${shareLink}`;

    await ctx.replyWithHTML(
      `<b>Сделка создана!</b>\n\nID: ${dealId}\nВаша роль: ${roleText}\nСумма: ${amount} ${currency}\nОписание:\n${links.join('\n')}\n\n${inviteText}\n\nПоддержка: @AgentNFTDeals`,
      Markup.inlineKeyboard([
        [Markup.button.url('📦 Показать подарок', links[0])],
        [Markup.button.callback('✅ Завершить сделку', `complete_deal_${dealId}`)],
        [Markup.button.callback('🔙 В меню', 'main_menu')]
      ])
    );
    return;
  }

  // ----- ДОБАВЛЕНИЕ КАРТЫ -----
  if (step === 'add_card') {
    const parts = text.split(' - ');
    if (parts.length !== 2) return ctx.reply('❌ Формат: Банк - Номер карты');
    const userId = ctx.from.id;
    const reqs = getRequisites(userId);
    reqs.cards.push({ bank: parts[0].trim(), number: parts[1].trim() });
    saveRequisites(userId, reqs);
    ctx.session.step = 'idle';
    await ctx.reply('✅ Карта добавлена!', { ...backToMenuKeyboard });
    return;
  }

  // ----- ДОБАВЛЕНИЕ TON -----
  if (step === 'add_ton') {
    const address = text;
    if (!address.startsWith('UQ') && !address.startsWith('EQ')) {
      return ctx.reply('❌ Адрес должен начинаться с UQ или EQ.');
    }
    const userId = ctx.from.id;
    const reqs = getRequisites(userId);
    reqs.tonWallets.push({ address });
    saveRequisites(userId, reqs);
    ctx.session.step = 'idle';
    await ctx.reply('✅ TON кошелек добавлен!', { ...backToMenuKeyboard });
    return;
  }

  // ----- НЕПРАВИЛЬНЫЙ ВВОД НА ШАГЕ ССЫЛОК -----
  if (step === 'create_deal_links') {
    return ctx.reply('⚠️ Введите ссылки в формате https://... или t.me/...');
  }

  // ----- ПОДСКАЗКА ДЛЯ IDLE -----
  if (step === 'idle' && !text.startsWith('/')) {
    await ctx.reply('ℹ️ Используйте /start или кнопки меню. Для отмены – /cancel');
  }
});

// ------------------ ОСТАЛЬНЫЕ CALLBACK'И ------------------
bot.action('profile', async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);
  const stats = user.stats;
  await ctx.editMessageText(
    `<b>Профиль пользователя</b>\n\nЮзер: @${user.username || 'не указан'}\nID: ${userId}\n\nБаланс: ${user.balance} ₽\n\nСтатистика:\n- Всего сделок: ${stats.total}\n- Успешных: ${stats.successful}\n- Оборот: ${stats.turnover} ₽\n\nВерификация: ${user.verified ? '✅ Пройдена' : '⚙️ Не пройдена'}\n\nПоддержка: @AgentNFTDeals`,
    { parse_mode: 'HTML', ...profileKeyboard }
  );
});

bot.action('requisites', async (ctx) => {
  await ctx.editMessageText('Управление реквизитами', { ...requisitesMenuKeyboard });
});

bot.action('add_card', async (ctx) => {
  ctx.session.step = 'add_card';
  await ctx.editMessageText(
    'Добавить банковскую карту\n\nФормат: Банк - Номер карты\nПример: Сбербанк - 1234 5678 9012 3456\n\nОтправьте реквизиты одним сообщением:',
    Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'requisites')]])
  );
});

bot.action('add_ton', async (ctx) => {
  ctx.session.step = 'add_ton';
  await ctx.editMessageText(
    'Добавить TON кошелек\n\nПример: UQAY6fREx6M7QsnCkUJKNptZdRG-Q_1kW2FAa2Am-aBJ-s-7X\n\nОтправьте адрес:',
    Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'requisites')]])
  );
});

bot.action('view_requisites', async (ctx) => {
  const userId = ctx.from.id;
  const reqs = getRequisites(userId);
  let text = '📋 <b>Ваши реквизиты</b>\n\n';
  if (reqs.cards.length === 0 && reqs.tonWallets.length === 0) text += 'Нет сохранённых реквизитов.';
  else {
    if (reqs.cards.length) {
      text += '<b>Банковские карты:</b>\n';
      reqs.cards.forEach((c, i) => text += `${i+1}. ${c.bank} - ${c.number}\n`);
      text += '\n';
    }
    if (reqs.tonWallets.length) {
      text += '<b>TON кошельки:</b>\n';
      reqs.tonWallets.forEach((w, i) => text += `${i+1}. ${w.address}\n`);
    }
  }
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...backToMenuKeyboard });
});

bot.action('referrals', async (ctx) => {
  await ctx.editMessageText('🔗 Реферальная система\n\nСкоро появится.', { parse_mode: 'HTML', ...backToMenuKeyboard });
});

bot.action('history', async (ctx) => {
  const userId = ctx.from.id;
  const deals = getUserDeals(userId);
  if (!deals.length) {
    await ctx.editMessageText('📜 История сделок\n\nУ вас пока нет сделок.', { parse_mode: 'HTML', ...backToMenuKeyboard });
  } else {
    let text = '📜 <b>Ваши сделки</b>\n\n';
    deals.forEach((d, i) => {
      text += `${i+1}. ID: ${d.id}\nРоль: ${d.buyerId === userId ? 'Покупатель' : 'Продавец'}\nСумма: ${d.amount} ${d.currency}\nСтатус: ${d.status}\nДата: ${new Date(d.createdAt).toLocaleString()}\n\n`;
    });
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...backToMenuKeyboard });
  }
});

bot.action('support', async (ctx) => {
  await ctx.editMessageText('📧 <b>Поддержка</b>\n\nСвяжитесь с нами: @AgentNFTDeals', { parse_mode: 'HTML', ...backToMenuKeyboard });
});

bot.action('topup', async (ctx) => ctx.answerCbQuery('💰 В разработке'));
bot.action('withdraw', async (ctx) => ctx.answerCbQuery('💸 В разработке'));
bot.action('promo', async (ctx) => ctx.answerCbQuery('🎫 Скоро'));

bot.action(/^complete_deal_(.+)$/, async (ctx) => {
  const dealId = ctx.match[1];
  const deal = getDeal(dealId);
  if (!deal) return ctx.reply('❌ Сделка не найдена.');
  if (deal.status === 'completed') return ctx.reply('✅ Уже завершена.');
  const userId = ctx.from.id;
  if (deal.buyerId !== userId && deal.sellerId !== userId) return ctx.reply('❌ Вы не участник.');
  deal.status = 'completed';
  deal.completedAt = new Date().toISOString();
  saveDeal(deal);

  const buyer = getUser(deal.buyerId);
  const seller = getUser(deal.sellerId);
  buyer.stats.successful += 1;
  buyer.stats.turnover += deal.amount;
  seller.stats.successful += 1;
  seller.stats.turnover += deal.amount;
  updateUser(deal.buyerId, { stats: buyer.stats });
  updateUser(deal.sellerId, { stats: seller.stats });

  await ctx.reply(`✅ Сделка #${dealId} завершена!`, { ...backToMenuKeyboard });
  const otherId = deal.buyerId === userId ? deal.sellerId : deal.buyerId;
  if (otherId) {
    try { await bot.telegram.sendMessage(otherId, `✅ Сделка #${dealId} завершена @${ctx.from.username}.`); } catch {}
  }
});

// ------------------ ЗАПУСК ------------------
bot.launch()
  .then(() => console.log('🚀 Бот успешно запущен!'))
  .catch(err => console.error('❌ Ошибка запуска:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
