const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = 6255035187;

const users = {};
let rejectTarget = null;
let rejectStage = null;
let paymentTarget = null;

// ---------- RANDOM REVIEW ----------
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() * 100 < p;

function generateRandomReview() {
  const o = ["Amazing experience", "Really impressed", "Super satisfied", "Booked recently", "Car looks brand new"];
  const s = ["mobile car detailing", "interior and exterior detailing", "professional car detailing"];
  const q = ["attention to detail was excellent", "work was very professional", "finish was spotless"];
  const e = ["Highly recommended.", "Will book again.", "Five stars.", "Worth it."];
  const streets = ["Main Street", "Kingsway", "Broadway", "Granville Street"];

  let loc = "";
  if (chance(20)) loc = " in Vancouver";
  else if (chance(40)) loc = ` near ${pick(streets)}`;

  return `${pick(o)} with their ${pick(s)}${loc}. The ${pick(q)}. ${pick(e)}`;
}

// ---------- /WAKE ----------
bot.onText(/\/wake/, (msg) => {
  users[msg.from.id] = { step: "account_name" };
  bot.sendMessage(msg.chat.id, "Enter the ACCOUNT NAME you will use for the review:");
});

// ---------- TEXT ----------
bot.on("message", (msg) => {
  const id = msg.from.id;

  // Admin writing rejection reason
  if (id === ADMIN_ID && rejectTarget && rejectStage) {
    bot.sendMessage(rejectTarget, `❌ Rejected\nReason:\n${msg.text}`);
    rejectTarget = null;
    rejectStage = null;
    return;
  }

  if (!users[id] || !msg.text) return;

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
  const data = q.data;

  // USER
  if (data === "logo_yes") {
    users[id].hasLogo = true;
    users[id].step = "logo_upload";
    bot.sendMessage(id, "Upload the LOGO image.");
  }

  if (data === "logo_no") {
    users[id].hasLogo = false;
    sendToAdmin(id);
    bot.sendMessage(id, "⏳ Waiting for admin approval...");
  }

  // ADMIN APPROVE ACCOUNT
  if (data.startsWith("approve_account_") && id === ADMIN_ID) {
    const uid = data.split("_")[2];
    users[uid].step = "awaiting_review";

    bot.sendMessage(
      uid,
      `✅ Approved!\n\nReview page:\nhttps://maps.app.goo.gl/vgQ2xvfdKRxEJaBD7\n\nCopy review:\n\n"${generateRandomReview()}"\n\n📸 Send screenshot after posting.`
    );
  }

  // ADMIN REJECT ACCOUNT
  if (data.startsWith("reject_account_") && id === ADMIN_ID) {
    rejectTarget = data.split("_")[2];
    rejectStage = "account";
    bot.sendMessage(ADMIN_ID, "✍ Type rejection reason (or type /skip):");
  }

  // ADMIN REVIEW CONFIRM
  if (data.startsWith("approve_review_") && id === ADMIN_ID) {
    const uid = data.split("_")[2];
    users[uid].step = "awaiting_qr";
    bot.sendMessage(uid, "✅ Review verified. Send your QR code.");
  }

  // ADMIN REVIEW REJECT OPTIONS
  if (data.startsWith("reject_review_") && id === ADMIN_ID) {
    const uid = data.split("_")[2];
    bot.sendMessage(ADMIN_ID, "Choose rejection type:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Reject (no reason)", callback_data: `reject_review_silent_${uid}` }],
          [{ text: "✍ Reject with reason", callback_data: `reject_review_reason_${uid}` }]
        ]
      }
    });
  }

  if (data.startsWith("reject_review_silent_") && id === ADMIN_ID) {
    const uid = data.split("_")[3];
    bot.sendMessage(uid, "❌ Review rejected. Please try again.");
  }

  if (data.startsWith("reject_review_reason_") && id === ADMIN_ID) {
    rejectTarget = data.split("_")[3];
    rejectStage = "review";
    bot.sendMessage(ADMIN_ID, "✍ Type rejection reason:");
  }

  // ADMIN MARK PAID
  if (data.startsWith("mark_paid_") && id === ADMIN_ID) {
    paymentTarget = data.split("_")[2];
    bot.sendMessage(ADMIN_ID, "📸 Upload payment screenshot.");
  }
});

// ---------- PHOTO ----------
bot.on("photo", (msg) => {
  const id = msg.from.id;
  const fileId = msg.photo.at(-1).file_id;

  // USER LOGO
  if (users[id]?.step === "logo_upload") {
    sendToAdmin(id, fileId);
    bot.sendMessage(id, "⏳ Waiting for admin approval...");
  }

  // USER REVIEW PROOF
  if (users[id]?.step === "awaiting_review") {
    bot.sendPhoto(ADMIN_ID, fileId, {
      caption: `📸 REVIEW PROOF\nUser ID: ${id}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve_review_${id}` },
            { text: "❌ Reject", callback_data: `reject_review_${id}` }
          ]
        ]
      }
    });
  }

  // USER QR
  if (users[id]?.step === "awaiting_qr") {
    bot.sendPhoto(ADMIN_ID, fileId, {
      caption: `💳 QR CODE\nUser ID: ${id}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 Mark Paid", callback_data: `mark_paid_${id}` }]
        ]
      }
    });
  }

  // ADMIN PAYMENT PROOF
  if (id === ADMIN_ID && paymentTarget) {
    bot.sendPhoto(paymentTarget, fileId, {
      caption: "💰 Payment proof"
    });
    paymentTarget = null;
  }
});

// ---------- ADMIN SEND ----------
function sendToAdmin(uid, logo = null) {
  bot.sendMessage(
    ADMIN_ID,
    `📝 NEW REVIEW REQUEST\n\nReview Account: ${users[uid].reviewAccount}\nLogo: ${users[uid].hasLogo ? "Yes" : "Text only"}`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve_account_${uid}` },
            { text: "❌ Reject", callback_data: `reject_account_${uid}` }
          ]
        ]
      }
    }
  );
  if (logo) bot.sendPhoto(ADMIN_ID, logo);
}

console.log("BOT LIVE");
