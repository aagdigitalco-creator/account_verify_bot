const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// TEMP storage (resets if Railway restarts)
const usedUsers = new Set();

bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (usedUsers.has(userId)) {
    bot.sendMessage(chatId, "❌ You have already used this bot.");
    return;
  }

  usedUsers.add(userId);

  bot.sendMessage(
    chatId,
    "✅ Welcome to Mappa Verification Bot\n\nPlease send your BUSINESS NAME."
  );
});

console.log("Bot running with user lock");
