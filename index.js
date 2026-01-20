const TelegramBot = require("node-telegram-bot-api");

const token = process.env.BOT_TOKEN;
const ADMIN_ID = 6255035187;

const bot = new TelegramBot(token, { polling: true });
const users = {};
let awaitingRejectionReason = null;

// ---------- HELPERS ----------
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() * 100 < p;

function generateRandomReview() {
  const open = ["Amazing service", "Really impressed", "Super happy", "Great experience"];
  const service = ["mobile car detailing", "car detailing service", "interior detailing"];
  const quality = ["very professional", "spotless finish", "great attention to detail"];
  const street = ["Main St", "Kingsway", "Broadway", "Granville St"];

  let loc = "";
  if (chance(20)) loc = " in Vancouver";
  else if (chance(40)) loc = ` near ${pick(street)}`;

  return `${pick(open)} with their ${pick(service)}${loc}. The work was ${pick(quality)}. Highly recommended.`;
}

// ---------- /WAKE ----------
bot.onText(/\/wake/, (msg) => {
  users[msg.from.id] = { step: "account" };
  bot.sendMessage(msg.chat.id, "Enter ACCOUNT NAME:");
});

// ---------- TEXT ----------
bot.on("message", (msg) => {
  const id = msg.from.id;

  // Admin rejection reason
  if (id === ADMIN_ID && awaitingRejectionReason) {
    bot.sendMessage(awaitingRejectionReason, `❌ Rejected:\n${msg.text}`);
    awaitingRejectionReason = null;
    return;
  }

  // Forward all user messages to admin
  if (id !== ADMIN_ID && msg.text) {
    bot.sendMessage(
      ADMIN_ID,
      `💬 USER MESSAGE\nUser ID: ${id}\n\n${msg.text}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✍ Reply", callback_data: `reply_${id}` }]
          ]
        }
      }
    );
  }

  if (!users[id] || !msg.text) return;

  if (users[id].step === "account") {
    users[id].account = msg.text;
    users[id].step = "logo";
    bot.sendMessage(id, "Does account have a logo?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Yes", callback_data: "logo_yes" }],
          [{ text: "No (alphabet/text)", callback_data: "logo_no" }]
        ]
      }
    });
  }
});

// ---------- CALLBACK ----------
bot.on("callback_query", (q) => {
  const id = q.from.id;
  const data = q.data;

  if (data === "logo_yes") {
    users[id].step = "logo_upload";
    users[id].hasLogo = true;
    bot.sendMessage(id, "Upload logo image.");
  }

  if (data === "logo_no") {
    users[id].hasLogo = false;
    sendToAdmin(id);
    bot.sendMessage(id, "⏳ Waiting for admin approval...");
  }

  if (data.startsWith("approve_") && id === ADMIN_ID) {
    const uid = data.split("_")[1];
    users[uid].step = "review";
    bot.sendMessage(
      uid,
      `✅ Approved!\n\nReview link:\nhttps://maps.app.goo.gl/vgQ2xvfdKRxEJaBD7\n\nCopy review:\n"${generateRandomReview()}"\n\nSend screenshot after posting.`
    );
  }

  if (data.startsWith("reject_") && id === ADMIN_ID) {
    awaitingRejectionReason = data.split("_")[1];
    bot.sendMessage(ADMIN_ID, "✍ Type rejection reason:");
  }

  if (data.startsWith("reply_") && id === ADMIN_ID) {
    awaitingRejectionReason = data.split("_")[1];
    bot.sendMessage(ADMIN_ID, "✍ Type message to send to user:");
  }
});

// ---------- PHOTO ----------
bot.on("photo", (msg) => {
  const id = msg.from.id;
  const fileId = msg.photo.at(-1).file_id;

  if (users[id]?.step === "logo_upload") {
    sendToAdmin(id, fileId);
    bot.sendMessage(id, "⏳ Waiting for admin approval...");
  }

  if (users[id]?.step === "review") {
    bot.sendPhoto(ADMIN_ID, fileId, {
      caption: `📸 REVIEW PROOF\nUser ID: ${id}`
    });
  }
});

// ---------- ADMIN ----------
function sendToAdmin(uid, logo = null) {
  bot.sendMessage(
    ADMIN_ID,
    `📝 NEW USER\nAccount: ${users[uid].account}\nLogo: ${users[uid].hasLogo ? "Yes" : "Text only"}`,
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

console.log("BOT LIVE");
