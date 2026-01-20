const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;
const ADMIN_ID = 6255035187;

const bot = new TelegramBot(token, { polling: true });

const users = {};

// ---------- RANDOM REVIEW ENGINE ----------
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chance(percent) {
  return Math.random() * 100 < percent;
}

function generateRandomReview() {
  const openings = [
    "Amazing experience",
    "Really impressed",
    "Super satisfied",
    "Booked them recently",
    "Did not expect this level of quality",
    "Car looks brand new"
  ];

  const services = [
    "mobile car detailing",
    "full detailing service",
    "interior and exterior detailing",
    "professional mobile detailing"
  ];

  const qualities = [
    "attention to detail was excellent",
    "work was extremely professional",
    "finish was spotless",
    "results were top-tier",
    "everything was cleaned perfectly"
  ];

  const endings = [
    "Highly recommended.",
    "Will book again.",
    "Five stars.",
    "Worth it.",
    "Very happy with the service."
  ];

  const streets = [
    "Main Street",
    "Kingsway",
    "Granville Street",
    "Broadway",
    "Commercial Drive",
    "Cambie Street",
    "Hastings Street",
    "Marine Drive"
  ];

  let locationPart = "";
  if (chance(20)) {
    locationPart = " in Vancouver";
  } else if (chance(40)) {
    locationPart = ` around ${pick(streets)}`;
  }

  return `${pick(openings)} with their ${pick(services)}${locationPart}. The ${pick(qualities)}. ${pick(endings)}`;
}

// ---------- /WAKE ----------
bot.onText(/\/wake/, (msg) => {
  users[msg.from.id] = { step: "account_name" };
  bot.sendMessage(msg.chat.id, "Enter ACCOUNT NAME for review:");
});

// ---------- TEXT ----------
bot.on("message", (msg) => {
  const id = msg.from.id;
  if (!users[id] || !msg.text) return;

  if (users[id].step === "account_name") {
    users[id].accountName = msg.text;
    users[id].step = "logo_check";

    bot.sendMessage(id, "Does this account have a logo?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Yes", callback_data: "logo_yes" }],
          [{ text: "No (alphabet / text logo)", callback_data: "logo_no" }]
        ]
      }
    });
  }
});

// ---------- CALLBACK ----------
bot.on("callback_query", (q) => {
  const id = q.from.id;
  if (!users[id]) return;

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

    bot.sendMessage(
      userId,
      `✅ Approved!\n\nReview this page:\nhttps://maps.app.goo.gl/vgQ2xvfdKRxEJaBD7\n\nCopy & paste review:\n\n"${generateRandomReview()}"\n\n📸 Send screenshot after posting.`
    );
  }

  if (q.data.startsWith("confirm_review_") && id === ADMIN_ID) {
    const userId = q.data.split("_")[2];
    users[userId].step = "awaiting_qr";
    bot.sendMessage(userId, "✅ Review verified. Send your QR code.");
  }

  if (q.data.startsWith("mark_paid_") && id === ADMIN_ID) {
    users.paymentTarget = q.data.split("_")[2];
    bot.sendMessage(ADMIN_ID, "📸 Upload payment screenshot.");
  }
});

// ---------- PHOTO ----------
bot.on("photo", (msg) => {
  const id = msg.from.id;
  if (!users[id]) return;

  const fileId = msg.photo.at(-1).file_id;

  if (users[id].step === "logo_upload") {
    sendToAdmin(id, fileId);
    bot.sendMessage(id, "⏳ Waiting for admin approval...");
  }

  if (users[id].step === "awaiting_review") {
    bot.sendPhoto(ADMIN_ID, fileId, {
      caption: `📸 REVIEW PROOF\nUser ID: ${id}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Confirm", callback_data: `confirm_review_${id}` }]
        ]
      }
    });
  }

  if (users[id].step === "awaiting_qr") {
    bot.sendPhoto(ADMIN_ID, fileId, {
      caption: `💳 QR CODE\nUser ID: ${id}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 Mark Paid", callback_data: `mark_paid_${id}` }]
        ]
      }
    });
  }

  if (id === ADMIN_ID && users.paymentTarget) {
    bot.sendPhoto(users.paymentTarget, fileId, {
      caption: "💰 Payment confirmation"
    });
    users.paymentTarget = null;
  }
});

// ---------- ADMIN ----------
function sendToAdmin(userId, logo = null) {
  bot.sendMessage(
    ADMIN_ID,
    `📝 NEW REQUEST\n\nAccount: ${users[userId].accountName}\nLogo: ${users[userId].hasLogo ? "Yes" : "Alphabet / Text only"}`,
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

console.log("BOT LIVE — use /wake");
