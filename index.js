const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const ADMIN_ID = 123456789; // <-- PUT YOUR TELEGRAM ID HERE

const bot = new TelegramBot(token, { polling: true });

const users = {};
const lockedUsers = new Set();

bot.onText(/\/start/, (msg) => {
  const id = msg.from.id;
  const chat = msg.chat.id;

  if (lockedUsers.has(id)) {
    bot.sendMessage(chat, "❌ You have already used this bot.");
    return;
  }

  users[id] = { step: 'account_name' };
  lockedUsers.add(id);

  bot.sendMessage(chat, "Enter the ACCOUNT NAME you will use for the review:");
});

bot.on('message', (msg) => {
  const id = msg.from.id;
  const chat = msg.chat.id;

  if (!users[id]) return;

  // STEP 1: ACCOUNT NAME
  if (users[id].step === 'account_name' && msg.text) {
    users[id].accountName = msg.text;
    users[id].step = 'logo_check';

    bot.sendMessage(chat, "Does this account have a logo?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Yes", callback_data: "logo_yes" }],
          [{ text: "No", callback_data: "logo_no" }]
        ]
      }
    });
  }
});

bot.on('callback_query', (query) => {
  const id = query.from.id;
  const chat = query.message.chat.id;

  if (!users[id]) return;

  // LOGO YES
  if (query.data === 'logo_yes') {
    users[id].hasLogo = true;
    users[id].step = 'logo_upload';
    bot.sendMessage(chat, "Please upload the LOGO image.");
  }

  // LOGO NO
  if (query.data === 'logo_no') {
    users[id].hasLogo = false;
    sendToAdmin(id);
    bot.sendMessage(chat, "✅ Submitted for review. Please wait.");
    delete users[id];
  }
});

// STEP 2: LOGO UPLOAD
bot.on('photo', (msg) => {
  const id = msg.from.id;
  if (!users[id] || users[id].step !== 'logo_upload') return;

  users[id].logo = msg.photo[msg.photo.length - 1].file_id;
  sendToAdmin(id);
  bot.sendMessage(msg.chat.id, "✅ Submitted for review. Please wait.");
  delete users[id];
});

// SEND DATA TO ADMIN
function sendToAdmin(userId) {
  const u = users[userId];

  bot.sendMessage(
    ADMIN_ID,
    `📝 NEW REVIEW REQUEST\n\nAccount Name: ${u.accountName}\nLogo: ${u.hasLogo ? "Yes" : "No"}`
  );

  if (u.logo) {
    bot.sendPhoto(ADMIN_ID, u.logo);
  }
}

console.log("Bot running with review flow");
