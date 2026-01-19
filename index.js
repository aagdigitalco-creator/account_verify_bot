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
          [{ text: "Yes", callback_data: "logo_yes" }],
          [{ text: "No", callback_data: "logo_no" }]
        ]
      }
    });
  }
});

// ---------------- CALLBACK HANDLER ----------------
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

  // ADMIN APPROVE ACCOUNT
  if (query.data.startsWith('approve_') && query.from.id === ADMIN_ID) {
    const userId = query.data.split('_')[1];

    users[userId].step = "awaiting_screenshot";

    bot.sendMessage(
      userId,
      "✅ Approved!\n\n" +
      "👉 Go to this Google Maps page and post a review:\n" +
      "https://maps.app.goo.gl/vgQ2xvfdKRxEJaBD7\n\n" +
      "📸 After posting, send a screenshot as proof."
    );

    delete pendingApproval[userId];
  }

  // ADMIN REJECT ACCOUNT
  if (query.data.startsWith('reject_') && query.from.id === ADMIN_ID) {
    const userId = query.data.split('_')[1];
    bot.sendMessage(userId, "❌ Rejected. You are not eligible.");
    delete pendingApproval[userId];
  }

  // ADMIN CONFIRM REVIEW SCREENSHOT
  if (query.data.startsWith('confirm_review_') && query.from.id === ADMIN_ID) {
    const userId = query.data.split('_')[2];

    bot.sendMessage(
      userId,
      "✅ Review verified.\n\nPlease wait for payment instructions."
    );

    users[userId].step = "review_done";
  }

  // ADMIN REJECT REVIEW SCREENSHOT
  if (query.data.startsWith('reject_review_') && query.from.id === ADMIN_ID) {
    const userId = query.data.split('_')[2];

    bot.sendMessage(
      userId,
      "❌ Screenshot rejected. Please send a valid review proof."
    );

    users[userId].step = "awaiting_screenshot";
  }
});

// ---------------- PHOTO HANDLER ----------------
bot.on('photo', (msg) => {
  const id = msg.from.id;

  // LOGO UPLOAD
  if (users[id] && users[id].step === 'logo_upload') {
    users[id].logo = msg.photo[msg.photo.length - 1].file_id;
    sendToAdmin(id);
    bot.sendMessage(msg.chat.id, "⏳ Waiting for admin approval...");
    return;
  }

  // REVIEW SCREENSHOT
  if (users[id] && users[id].step === 'awaiting_screenshot') {
    const screenshot = msg.photo[msg.photo.length - 1].file_id;

    bot.sendPhoto(
      ADMIN_ID,
      screenshot,
      {
        caption: `📸 REVIEW PROOF\nUser: ${users[id].accountName}\nID: ${id}`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Confirm", callback_data: `confirm_review_${id}` },
              { text: "❌ Reject", callback_data: `reject_review_${id}` }
            ]
          ]
        }
      }
    );

    bot.sendMessage(id, "⏳ Screenshot sent for verification.");
  }
});

// ---------------- SEND TO ADMIN ----------------
function sendToAdmin(userId) {
  const u = users[userId];
  pendingApproval[userId] = u;

  bot.sendMessage(
    ADMIN_ID,
    `📝 NEW REVIEW REQUEST\n\nAccount Name: ${u.accountName}\nLogo: ${u.hasLogo ? "Yes" : "No"}`,
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

console.log("Bot running — review + screenshot flow active");
