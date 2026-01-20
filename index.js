const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;
const ADMIN_ID = 123456789; // YOUR TELEGRAM ID

const bot = new TelegramBot(token, { polling: true });

const users = {};
const lockedUsers = new Set();

// ---------- RANDOM REVIEW ENGINE ----------
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomReview() {
  const openers = [
    "Had an amazing experience",
    "Really impressed",
    "Super happy with the service",
    "Booked them recently",
    "My car looks brand new",
    "Did not expect this level of quality"
  ];

  const services = [
    "mobile car detailing",
    "full car detailing",
    "interior and exterior detailing",
    "professional mobile detailing",
    "complete detailing service"
  ];

  const locations = [
    "in Vancouver",
    "around Vancouver",
    "here in Vancouver",
    "in the Vancouver area",
    "locally in Vancouver"
  ];

  const qualities = [
    "The attention to detail was excellent.",
    "They were professional and on time.",
    "Everything was cleaned perfectly.",
    "The finish was top-notch.",
    "You can tell they care about quality."
  ];

  const extras = [
    "Interior looked spotless.",
    "Paint looked fresh and shiny.",
    "Very convenient mobile service.",
    "Pricing felt fair for the quality.",
    "Great experience overall."
  ];

  const endings = [
    "Highly recommend.",
    "Would definitely book again.",
    "Five stars.",
    "Worth every dollar.",
    "Glad I chose them."
  ];

  return `${pick(openers)} with their ${pick(services)} ${pick(locations)}. ${pick(qualities)} ${pick(extras)} ${pick(endings)}`;
}

// ---------- START ----------
bot.onText(/\/start/, (msg) => {
  const id = msg.from.id;

  // ADMIN CAN ALWAYS RESTART
  if (id === ADMIN_ID) {
    users[id] = { step: "account_name" };
    bot.sendMessage(id, "🛠 ADMIN TEST MODE\nEnter ACCOUNT NAME:");
    return;
  }

  // NORMAL USERS (ONE TIME)
  if (lockedUsers.has(id)) {
    bot.sendMessage(id, "❌ You have already completed this task.");
    return;
  }

  lockedUsers.add(id);
  users[id] = { step: "account_name" };
  bot.sendMessage(id, "Enter the ACCOUNT NAME for review:");
});

// ---------- TEXT ----------
bot.on("message", (msg) => {
  const id = msg.from.id;
  if (!users[id]) return;

  if (users[id].step === "account_name" && msg.text) {
    users[id].accountName = msg.text;
    users[id].step = "logo_check";

    bot.sendMessage(id, "Does this account have a logo?", {
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
bot.on("callback_query", (q) => {
  const id = q.from.id;

  if (q.data === "logo_yes") {
    users[id].hasLogo = true;
    users[id].step = "logo_upload";
    bot.sendMessage(id, "Upload the LOGO image.");
  }

  if (q.data === "logo_no") {
    users[id].hasLogo = false;
    sendToAdmin(id);
    bot.sendMessage(id, "⏳ Waiting for admin approval...");
  }

  if (q.data.startsWith("approve_") && id === ADMIN_ID) {
    const userId = q.data.split("_")[1];
    users[userId].step = "awaiting_review";

    const review = generateRandomReview();

    bot.sendMessage(
      userId,
      "✅ Approved!\n\n" +
      "👉 Leave a Google Maps review:\n" +
      "https://maps.app.goo.gl/vgQ2xvfdKRxEJaBD7\n\n" +
      "📋 Copy this review:\n\n" +
      `"${review}"\n\n` +
      "📸 Send screenshot after posting."
    );
  }

  if (q.data.startsWith("confirm_review_") && id === ADMIN_ID) {
    const userId = q.data.split("_")[2];
    users[userId].step = "awaiting_qr";
    bot.sendMessage(userId, "✅ Review verified.\nSend your QR code.");
  }

  if (q.data.startsWith("mark_paid_") && id === ADMIN_ID) {
    const userId = q.data.split("_")[2];
    users.paymentTarget = userId;
    bot.sendMessage(ADMIN_ID, "📸 Upload payment screenshot.");
  }
});

// ---------- PHOTO ----------
bot.on("photo", (msg) => {
  const id = msg.from.id;

  if (users[id]?.step === "logo_upload") {
    sendToAdmin(id, msg.photo.at(-1).file_id);
    bot.sendMessage(id, "⏳ Waiting for admin approval...");
  }

  if (users[id]?.step === "awaiting_review") {
    bot.sendPhoto(ADMIN_ID, msg.photo.at(-1).file_id, {
      caption: `📸 REVIEW PROOF\nID:${id}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Confirm", callback_data: `confirm_review_${id}` }]
        ]
      }
    });
    bot.sendMessage(id, "⏳ Screenshot sent.");
  }

  if (users[id]?.step === "awaiting_qr") {
    bot.sendPhoto(ADMIN_ID, msg.photo.at(-1).file_id, {
      caption: `💳 QR CODE\nID:${id}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 Mark Paid", callback_data: `mark_paid_${id}` }]
        ]
      }
    });
    bot.sendMessage(id, "⏳ Payment processing.");
  }

  if (id === ADMIN_ID && users.paymentTarget) {
    bot.sendPhoto(users.paymentTarget, msg.photo.at(-1).file_id, {
      caption: "💰 Payment confirmation"
    });
    bot.sendMessage(users.paymentTarget, "✅ Payment completed.");
    users.paymentTarget = null;
  }
});

// ---------- ADMIN SEND ----------
function sendToAdmin(userId, logo = null) {
  bot.sendMessage(
    ADMIN_ID,
    `📝 NEW REQUEST\nAccount: ${users[userId].accountName}\nLogo: ${users[userId].hasLogo ? "Yes" : "No"}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Approve", callback_data: `approve_${userId}` }]
        ]
      }
    }
  );
  if (logo) bot.sendPhoto(ADMIN_ID, logo);
}

console.log("BOT LIVE — ADMIN CAN RETEST UNLIMITED");
