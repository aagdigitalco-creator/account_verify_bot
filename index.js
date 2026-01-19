const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const ADMIN_ID = 123456789; // PUT YOUR TELEGRAM ID

const bot = new TelegramBot(token, { polling: true });

const users = {};
const lockedUsers = new Set();
const pendingApproval = {};

// ---------- START ----------
bot.onText(/\/start/, (msg) => {
  const id = msg.from.id;

  if (lockedUsers.has(id)) {
    bot.sendMessage(msg.chat.id, "❌ You have already completed this task.");
    return;
  }

  users[id] = { step: "account_name" };
  lockedUsers.add(id);

  bot.sendMessage(msg.chat.id, "Enter the ACCOUNT NAME you will use to post the review:");
});

// ---------- TEXT ----------
bot.on("message", (msg) => {
  const id = msg.from.id;
  if (!users[id]) return;

  if (users[id].step === "account_name" && msg.text) {
    users[id].accountName = msg.text;
    users[id].step = "logo_check";

    bot.sendMessage(msg.chat.id, "Does this account have a logo?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Yes", callback_data: "logo_yes" }],
          [{ text: "No", callback_data: "logo_no" }]
        ]
      }
    });
  }
});

// ---------- CALLBACK ----------
bot.on("callback_query", (query) => {
  const id = query.from.id;

  if (query.data === "logo_yes") {
    users[id].hasLogo = true;
    users[id].step = "logo_upload";
    bot.sendMessage(id, "Upload the LOGO image.");
  }

  if (query.data === "logo_no") {
    users[id].hasLogo = false;
    sendToAdmin(id);
    bot.sendMessage(id, "⏳ Waiting for admin approval...");
  }

  if (query.data.startsWith("approve_") && id === ADMIN_ID) {
    const userId = query.data.split("_")[1];
    users[userId].step = "awaiting_screenshot";

    bot.sendMessage(
      userId,
      "✅ Approved!\n\n👉 Leave a Google Maps review here:\n" +
      "https://maps.app.goo.gl/vgQ2xvfdKRxEJaBD7\n\n" +
      "📸 Send screenshot after posting."
    );

    delete pendingApproval[userId];
  }

  if (query.data.startsWith("reject_") && id === ADMIN_ID) {
    const userId = query.data.split("_")[1];
    bot.sendMessage(userId, "❌ Rejected.");
    delete pendingApproval[userId];
  }

  if (query.data.startsWith("confirm_review_") && id === ADMIN_ID) {
    const userId = query.data.split("_")[2];
    users[userId].step = "awaiting_qr";
    bot.sendMessage(userId, "✅ Review verified.\n\nSend your UPI QR code.");
  }

  if (query.data.startsWith("reject_review_") && id === ADMIN_ID) {
    const userId = query.data.split("_")[2];
    users[userId].step = "awaiting_screenshot";
    bot.sendMessage(userId, "❌ Screenshot rejected. Send valid proof.");
  }

  if (query.data.startsWith("payment_done_") && id === ADMIN_ID) {
    const userId = query.data.split("_")[2];
    users[userId].step = "completed";
    bot.sendMessage(userId, "💰 Payment sent! Thank you.");
  }
});

// ---------- PHOTO ----------
bot.on("photo", (msg) => {
  const id = msg.from.id;

  // LOGO
  if (users[id] && users[id].step === "logo_upload") {
    users[id].logo = msg.photo[msg.photo.length - 1].file_id;
    sendToAdmin(id);
    bot.sendMessage(id, "⏳ Waiting for admin approval...");
    return;
  }

  // REVIEW SCREENSHOT
  if (users[id] && users[id].step === "awaiting_screenshot") {
    const shot = msg.photo[msg.photo.length - 1].file_id;

    bot.sendPhoto(ADMIN_ID, shot, {
      caption: `📸 REVIEW PROOF\n${users[id].accountName}\nID: ${id}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Confirm", callback_data: `confirm_review_${id}` },
            { text: "❌ Reject", callback_data: `reject_review_${id}` }
          ]
        ]
      }
    });

    bot.sendMessage(id, "⏳ Screenshot sent for verification.");
    return;
  }

  // QR CODE
  if (users[id] && users[id].step === "awaiting_qr") {
    const qr = msg.photo[msg.photo.length - 1].file_id;

    bot.sendPhoto(ADMIN_ID, qr, {
      caption: `💳 UPI QR\nUser: ${users[id].accountName}\nID: ${id}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 Mark Paid", callback_data: `payment_done_${id}` }]
        ]
      }
    });

    bot.sendMessage(id, "⏳ Payment in process.");
  }
});

// ---------- ADMIN SEND ----------
function sendToAdmin(userId) {
  const u = users[userId];
  pendingApproval[userId] = u;

  bot.sendMessage(
    ADMIN_ID,
    `📝 NEW REQUEST\nAccount: ${u.accountName}\nLogo: ${u.hasLogo ? "Yes" : "No"}`,
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

console.log("LIVE: Full review → payment flow running");
