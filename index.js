const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = 6255035187;

const users = {};
let rejectTarget = null;
let paymentTarget = null;

// ---------- RANDOM REVIEW ENGINE ----------
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() * 100 < p;

function generateRandomReview() {
  const openings = [
    "Amazing experience",
    "Really impressed",
    "Super satisfied",
    "Booked recently",
    "Did not expect this quality",
    "Car looks brand new"
  ];

  const services = [
    "mobile car detailing",
    "interior and exterior detailing",
    "professional car detailing",
    "full detailing service"
  ];

  const qualities = [
    "attention to detail was excellent",
    "work was extremely professional",
    "finish was spotless",
    "results were impressive",
    "everything was cleaned perfectly"
  ];

  const endings = [
    "Highly recommended.",
    "Would book again.",
    "Five stars.",
    "Worth every dollar.",
    "Very happy."
  ];

  const streets = [
    "Main Street",
    "Kingsway",
    "Granville Street",
    "Broadway",
    "Cambie Street",
    "Commercial Drive"
  ];

  let location = "";
  if (chance(20)) location = " in Vancouver";
  else if (chance(40)) location = ` near ${pick(streets)}`;

  return `${pick(openings)} with their ${pick(services)}${location}. The ${pick(qualities)}. ${pick(endings)}`;
}

// ---------- /WAKE ----------
bot.onText(/\/wake/, (msg) => {
  users[msg.from.id] = { step: "account_name" };
  bot.sendMessage(msg.chat.id, "Enter the ACCOUNT NAME you will use to post the review:");
});

// ---------- TEXT ----------
bot.on("message", (msg) => {
  const id = msg.from.id;
  if (!users[id] || !msg.text) return;

  // Admin rejection reason
  if (id === ADMIN_ID && rejectTarget) {
    bot.sendMessage(rejectTarget, `❌ Rejected\nReason:\n${msg.text}`);
    rejectTarget = null;
    return;
  }

  if (users[id].step === "account_name") {
    users[id].reviewAccount = msg.text;
    users[id].step = "logo_check";

    bot.sendMessage(id, "Does this review account have a logo?", {
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
  if (!users[id] && id !== ADMIN_ID) return;

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
    const uid = q.data.split("_")[1];
    users[uid].step = "awaiting_review";

    bot.sendMessage(
      uid,
      `✅ Approved!\n\nReview this page:\nhttps://maps.app.goo.gl/vgQ2xvfdKRxEJaBD7\n\nCopy & paste review:\n\n"${generateRandomReview()}"\n\n📸 Send screenshot after posting.`
    );
  }

  if (q.data.startsWith("reject_") && id === ADMIN_ID) {
    rejectTarget = q.data.split("_")[1];
    bot.sendMessage(ADMIN_ID, "✍ Type rejection reason:");
  }

  if (q.data.startsWith("confirm_review_") && id === ADMIN_ID) {
    const uid = q.data.split("_")[2];
    users[uid].step = "awaiting_qr";
    bot.sendMessage(uid, "✅ Review verified. Send your QR code.");
  }

  if (q.data.startsWith("mark_paid_") && id === ADMIN_ID) {
    paymentTarget = q.data.split("_")[2];
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

  if (id === ADMIN_ID && paymentTarget) {
    bot.sendPhoto(paymentTarget, fileId, {
      caption: "💰 Payment confirmation"
    });
    paymentTarget = null;
  }
});

// ---------- ADMIN ----------
function sendToAdmin(uid, logo = null) {
  bot.sendMessage(
    ADMIN_ID,
    `📝 NEW REVIEW REQUEST\n\nReview Account: ${users[uid].reviewAccount}\nLogo: ${users[uid].hasLogo ? "Yes" : "Text only"}`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve_${uid}` },
            { text: "❌ Reject", callback_data: `reject_${uid}` }
          ]
        ]
      }
    }
  );
  if (logo) bot.sendPhoto(ADMIN_ID, logo);
}

console.log("BOT LIVE — use /wake");
