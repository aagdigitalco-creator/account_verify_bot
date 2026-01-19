const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const ADMIN_ID = 123456789; // <-- PUT YOUR TELEGRAM ID HERE

const bot = new TelegramBot(token, { polling: true });

// STORAGE
const users = {};
const lockedUsers = new Set();
const pendingApproval = {};

// ---------------- START ----------------
bot.onText(/\/start/, (msg) => {
  const id = msg.from.id;
  const chat = msg.chat.id;

  if (lockedUsers.has(id)) {
    bot.sendMessage(chat, "❌ You have already applied.");
    return;
  }

  users[id] = { step: 'account_name' };
  lockedUsers.add(id);

  bot.sendMessage(chat, "Enter the ACCOUNT NAME you will use to post the review:");
});

// ---------------- TEXT HANDLER ----------------
bot.on('message', (msg) => {
  const id = msg.from.id;
  const chat = msg.chat.id;

  if (!users[id]) return;

  if (users[id].step === 'account_name' && msg.text) {
    users[id].accountName = msg.text;
    users[id].step = 'logo_check';

    bot.sendMessage(chat, "Does this account have a logo?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Yes", callbac]()
