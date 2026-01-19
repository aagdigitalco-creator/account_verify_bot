const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const ADMIN_ID = 123456789; // <-- YOUR TELEGRAM ID

const bot = new TelegramBot(token, { polling: true });

// USER DATA
const users = {};
const lockedUsers = new Set();
const pendingApproval = {};

// START
bot.onText(/\/start/, (msg) => {
  const id = msg.from.id;
  const chat = msg.chat.id;

  if (lockedUsers.has(id)) {
    bot.sendMessage(chat, "❌ You have already applied.");
    return;
  }

  users[id] = { step: 'account_name' };
  lockedUsers.add(id);

  bot.sendMessage(chat, "Enter the ACCOUNT NAME for review:");
});

// TEXT HANDLER
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
          [{ text: "Yes", callback_data: "logo_yes" }],
          [{ text: "No", callback_data: "logo_no" }]
        ]
      }
    });
  }
});

// CALLBACK HANDLER
bot.on('callback_query', (query) => {
  const id = query.from.id;
  const chat = query.message.chat.id;

  // LOGO YES
  if (query.data === 'logo_yes') {
    users[id].hasLogo = true;
    users[id].step = 'logo_upload';
    bot.sendMessage(chat, "Upload the LOGO image.");
  }

  // LOGO NO
  if (query.data === 'logo_no') {
    users[id].hasLogo = false;
    sendToAdmin(id);
    bot.sendMessage(chat, "⏳ Waiting for admin approval...");
  }

  // ADMIN APPROVE
  if (query.data.startsWith('approve_') && query.from.id === ADMIN_ID) {
    const userId = query.data.split('_')[1];
    bot.sendMessage(userId, "✅ Approved! Please proceed with the task.");
    delete pendingApproval[userId];
  }

  // ADMIN REJECT
  if (query.data.startsWith('reject_') && query.from.id === ADMIN_ID) {
    const userId = query.data.split('_')[1];
    bot.sendMessage(userId, "❌ Rejected. You are not eligible.");
    delete pendingApproval[userId];
  }
});

// LOGO HANDLER
bot.on('photo', (msg) => {
  const id = msg.from.id;
  if (!users[id] || users[id].step !== 'logo_upload') return;

  users[id].logo = msg.photo[msg.photo.length - 1].file_id;
  sendToAdmin(id);

  bot.sendMessage(msg.chat.id, "⏳ Waiting for admin approval...");
});

// SEND TO ADMIN WITH BUTTONS
function sendToAdmin(userId) {
  const u = users[userId];
  pendingApproval[userId] = u;

  bot.sendMessage(
    ADMIN_ID,
    `📝 REVIEW REQUEST\n\nAccount: ${u.accountName}\nLogo: ${u.hasLogo ? "Yes" : "No"}`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve_${userId}` },
            { text: "❌ Reject", callback_data: `reject_${userId}` }
          ]
        ]
      }
    }
  );

  if (u.logo) bot.sendPhoto(ADMIN_ID, u.logo);
}

console.log("Bot running with admin approval system");
