/**
 * Matrix Family Telegram Bot
 * Single-file Cloudflare Worker (no build step, no npm, no Node APIs).
 * Requires only:
 *   - D1 binding: DB
 *   - Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, OWNER_TELEGRAM_ID
 *
 * Deploy via Cloudflare Dashboard -> Workers & Pages -> paste this file.
 * Then visit:  https://<your-worker>.workers.dev/setup?token=<TELEGRAM_WEBHOOK_SECRET>
 * once in your browser to register the Telegram webhook. No terminal needed.
 */

// ============================================================
// CONSTANTS - exact required question / message text (do not edit)
// ============================================================

const Q = {
  q1: "1- اسم گیم شما چیه ؟",
  q2: "2- اسم واقعی شما چیه؟",
  q3: "3-سن شما چقدر است ؟",
  q4: "4 - آیا به صورت مداوم در دولت فعالیت دارید؟",
  q5: "5 - اسکرین شات از /mm و /namestore و /wbook بفرستید",
  q6: "6 - آیا کسی از اعضای فمیلی رو میشناسید که فعالیت شما رو به ما توضیح بده؟ اسمش چیه ؟ (این بخش اختیاریست و میتوانید جواب ندید)",
  q7: "7 - دلیل لیو / کیک از فمیلی قبلی چیست؟",
  q8: "8 یک ویس بالای 5 ثانیه بدید مثال : (درود بنده میخوام عضو فمیلی بشم) دقت کنید ویس شما بالای 5 ثانیه باشد.",
};

const MSG_SUPPORT_PROMPT =
  "در صورتی که انتقادی به فمیلی دارید بنویسید و چناچنه پیشنهادی دارید مطرح کنید\nدر اسرع وقت به پیام شما جواب داده خواهد شد";

const MSG_MEMBERSHIP_INTRO =
  "درود به شما \nبرای پر کردن فرم درخواست عضویت حتما باید به ترتیب به سوال هایی که ربات میپرسه جواب بدید\nاین سوال ها به صورت مرحله ای از شما پرسیده میشوند";

const MSG_FORM_DONE =
  "فرم شما کاملا دریافت شد ✅\nفرم مستقیماً به استف فمیلی فرستاده شد و جواب آن نهایتا تا 72 ساعت به شما از طریق این ربات اطلاع داده میشه .\nلطفا اسپم یا درخواست قبل از این موقع نکنید .\nدر صورتی که تا 72 ساعت آینده فرم شما قبول یا رد نشد از بخش پشتیبانی با ما در ارتباط باشید.\nبا تشکر و آرزوی موفقیت برای شما🌹";

const MSG_ALREADY_PENDING = "شما یک درخواست در حال بررسی دارید. لطفاً تا اعلام نتیجه صبر کنید.";
const MSG_REJECT_REASON_PROMPT = "دلیل رد درخواست رو بنویسید";
const MSG_ALREADY_REVIEWED = "این درخواست قبلاً بررسی شده است.";
const MSG_APPROVED_USER = "درود فرم شما تایید شد و شما میتوانید عضو فمیلی بشید .";
const MSG_DISABLE_REASON_PROMPT = "چرا میخواهید فرم درخواست رو غیرفعال کنید";

const BTN_SUPPORT = "پشتیبانی/ انتقادات";
const BTN_MEMBERSHIP = "درخواست عضویت";
const BTN_ADMIN_PANEL = "Admin Panel";

// ============================================================
// DB INIT
// ============================================================

let DB_READY = false;

async function ensureDb(env) {
  if (DB_READY) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      telegram_id TEXT PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_banned INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS admins (
      telegram_id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS membership_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT,
      telegram_name TEXT,
      game_name TEXT,
      real_name TEXT,
      age TEXT,
      government_activity TEXT,
      family_member TEXT,
      previous_family_reason TEXT,
      voice_file_id TEXT,
      voice_duration INTEGER,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      reject_reason TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS membership_request_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      file_id TEXT NOT NULL,
      file_unique_id TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS form_sessions (
      user_id TEXT PRIMARY KEY,
      state TEXT,
      data TEXT,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT,
      name TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      sender_type TEXT NOT NULL,
      sender_id TEXT,
      message TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      actor_id TEXT,
      actor_name TEXT,
      target_id TEXT,
      target_name TEXT,
      detail TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'in_progress',
      total INTEGER NOT NULL DEFAULT 0,
      success INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      finished_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS broadcast_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broadcast_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_mem_status ON membership_requests(status)`,
    `CREATE INDEX IF NOT EXISTS idx_mem_user ON membership_requests(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sup_status ON support_tickets(status)`,
    `CREATE INDEX IF NOT EXISTS idx_bcr_lookup ON broadcast_recipients(broadcast_id, status)`,
  ];
  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }
  // defaults
  const enabled = await env.DB.prepare(`SELECT value FROM settings WHERE key='membership_requests_enabled'`).first();
  if (!enabled) {
    await env.DB.prepare(`INSERT INTO settings (key, value) VALUES ('membership_requests_enabled','1')`).run();
  }
  DB_READY = true;
}

// ============================================================
// SMALL UTILITIES
// ============================================================

function nowIso() {
  return new Date().toISOString();
}

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function tgApi(env, method, params) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN secret is not set. Add it in Cloudflare Dashboard -> Worker -> Settings -> Variables.");
  }
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params || {}),
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = { ok: false, description: "invalid json response from telegram" };
  }
  if (!data.ok) {
    console.log("Telegram API error:", method, JSON.stringify(data));
  }
  return data;
}

async function sendMessage(env, chatId, text, extra) {
  try {
    return await tgApi(env, "sendMessage", { chat_id: chatId, text, ...(extra || {}) });
  } catch (e) {
    console.log("sendMessage failed", e.message);
    return { ok: false };
  }
}

async function sendPhoto(env, chatId, fileId, caption, extra) {
  try {
    return await tgApi(env, "sendPhoto", { chat_id: chatId, photo: fileId, caption, ...(extra || {}) });
  } catch (e) {
    console.log("sendPhoto failed", e.message);
    return { ok: false };
  }
}

async function sendVoice(env, chatId, fileId, caption, extra) {
  try {
    return await tgApi(env, "sendVoice", { chat_id: chatId, voice: fileId, caption, ...(extra || {}) });
  } catch (e) {
    console.log("sendVoice failed", e.message);
    return { ok: false };
  }
}

async function answerCallback(env, callbackId, text, alert) {
  try {
    return await tgApi(env, "answerCallbackQuery", {
      callback_query_id: callbackId,
      text: text || undefined,
      show_alert: !!alert,
    });
  } catch (e) {
    return { ok: false };
  }
}

function mainMenuKeyboard(isAdminUser) {
  const rows = [[{ text: BTN_SUPPORT }], [{ text: BTN_MEMBERSHIP }]];
  if (isAdminUser) rows.push([{ text: BTN_ADMIN_PANEL }]);
  return { reply_markup: { keyboard: rows, resize_keyboard: true } };
}

function inline(rows) {
  return { reply_markup: { inline_keyboard: rows } };
}

// ============================================================
// DATA LAYER
// ============================================================

async function getUser(env, userId) {
  return await env.DB.prepare(`SELECT * FROM users WHERE telegram_id=?`).bind(String(userId)).first();
}

async function upsertUser(env, from) {
  const id = String(from.id);
  const existing = await getUser(env, id);
  const t = nowIso();
  if (existing) {
    await env.DB.prepare(
      `UPDATE users SET first_name=?, last_name=?, username=?, updated_at=? WHERE telegram_id=?`
    )
      .bind(from.first_name || "", from.last_name || "", from.username || "", t, id)
      .run();
    return { isNew: false, user: existing };
  } else {
    await env.DB.prepare(
      `INSERT INTO users (telegram_id, first_name, last_name, username, created_at, updated_at, is_banned) VALUES (?,?,?,?,?,?,0)`
    )
      .bind(id, from.first_name || "", from.last_name || "", from.username || "", t, t)
      .run();
    return { isNew: true, user: null };
  }
}

async function isOwner(env, userId) {
  return env.OWNER_TELEGRAM_ID && String(userId) === String(env.OWNER_TELEGRAM_ID);
}

async function isAdmin(env, userId) {
  if (await isOwner(env, userId)) return true;
  const row = await env.DB.prepare(`SELECT telegram_id FROM admins WHERE telegram_id=?`).bind(String(userId)).first();
  return !!row;
}

async function ensureAdminRow(env, userId, fallbackName) {
  const id = String(userId);
  const owner = await isOwner(env, id);
  const existing = await env.DB.prepare(`SELECT * FROM admins WHERE telegram_id=?`).bind(id).first();
  if (existing) return existing;
  const role = owner ? "OWNER" : "ADMIN";
  await env.DB.prepare(`INSERT INTO admins (telegram_id, role, display_name, created_at) VALUES (?,?,?,?)`)
    .bind(id, role, fallbackName || (owner ? "Owner" : "Admin"), nowIso())
    .run();
  return await env.DB.prepare(`SELECT * FROM admins WHERE telegram_id=?`).bind(id).first();
}

async function getDisplayName(env, userId) {
  const row = await env.DB.prepare(`SELECT display_name FROM admins WHERE telegram_id=?`).bind(String(userId)).first();
  if (row && row.display_name) return row.display_name;
  if (await isOwner(env, userId)) return "Owner";
  return "Admin";
}

async function getAllAdminIds(env) {
  const ids = new Set();
  if (env.OWNER_TELEGRAM_ID) ids.add(String(env.OWNER_TELEGRAM_ID));
  const rows = await env.DB.prepare(`SELECT telegram_id FROM admins`).all();
  for (const r of rows.results || []) ids.add(String(r.telegram_id));
  return Array.from(ids);
}

async function notifyAdmins(env, text, extra) {
  const ids = await getAllAdminIds(env);
  for (const id of ids) {
    await sendMessage(env, id, text, extra);
  }
}

async function auditLog(env, action, actorId, actorName, targetId, targetName, detail) {
  await env.DB.prepare(
    `INSERT INTO audit_logs (action, actor_id, actor_name, target_id, target_name, detail, created_at) VALUES (?,?,?,?,?,?,?)`
  )
    .bind(action, String(actorId || ""), actorName || "", String(targetId || ""), targetName || "", detail || "", nowIso())
    .run();
}

async function getSession(env, userId) {
  const row = await env.DB.prepare(`SELECT state, data FROM form_sessions WHERE user_id=?`).bind(String(userId)).first();
  if (!row) return { state: null, data: {} };
  let data = {};
  try {
    data = row.data ? JSON.parse(row.data) : {};
  } catch (e) {
    data = {};
  }
  return { state: row.state, data };
}

async function setSession(env, userId, state, data) {
  const id = String(userId);
  await env.DB.prepare(
    `INSERT INTO form_sessions (user_id, state, data, updated_at) VALUES (?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET state=excluded.state, data=excluded.data, updated_at=excluded.updated_at`
  )
    .bind(id, state, JSON.stringify(data || {}), nowIso())
    .run();
}

async function clearSession(env, userId) {
  await env.DB.prepare(`DELETE FROM form_sessions WHERE user_id=?`).bind(String(userId)).run();
}

async function getSetting(env, key, fallback) {
  const row = await env.DB.prepare(`SELECT value FROM settings WHERE key=?`).bind(key).first();
  return row ? row.value : fallback;
}

async function setSetting(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  )
    .bind(key, value)
    .run();
}

// ============================================================
// MEMBERSHIP FORM
// ============================================================

async function startMembershipIntro(env, chatId) {
  await sendMessage(env, chatId, MSG_MEMBERSHIP_INTRO, inline([[{ text: "میپذیرم ✅", callback_data: "mem:accept" }]]));
}

async function beginMembershipForm(env, userId) {
  await setSession(env, userId, "mem_q1", {});
  await sendMessage(env, userId, Q.q1);
}

async function nextQuestionAfter(env, userId, chatId, nextState, questionText, extra) {
  await setSession(env, userId, nextState, (await getSession(env, userId)).data);
  await sendMessage(env, chatId, questionText, extra);
}

async function submitMembershipRequest(env, userId, user, data) {
  const t = nowIso();
  const username = user ? user.username : "";
  const telegramName = [user ? user.first_name : "", user ? user.last_name : ""].filter(Boolean).join(" ");
  const result = await env.DB.prepare(
    `INSERT INTO membership_requests
      (user_id, username, telegram_name, game_name, real_name, age, government_activity, family_member, previous_family_reason, voice_file_id, voice_duration, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?, 'OPEN', ?, ?)`
  )
    .bind(
      String(userId),
      username || "",
      telegramName || "",
      data.game_name || "",
      data.real_name || "",
      data.age || "",
      data.government_activity || "",
      data.family_member || "",
      data.previous_family_reason || "",
      data.voice_file_id || "",
      data.voice_duration || 0,
      t,
      t
    )
    .run();
  const requestId = result.meta.last_row_id;
  for (const fileId of data.photos || []) {
    await env.DB.prepare(
      `INSERT INTO membership_request_images (request_id, file_id, file_unique_id, created_at) VALUES (?,?,?,?)`
    )
      .bind(requestId, fileId, "", t)
      .run();
  }
  return requestId;
}

async function sendMembershipRequestToAdmins(env, requestId) {
  const req = await env.DB.prepare(`SELECT * FROM membership_requests WHERE id=?`).bind(requestId).first();
  if (!req) return;
  const images = await env.DB.prepare(`SELECT file_id FROM membership_request_images WHERE request_id=?`).bind(requestId).all();
  const adminIds = await getAllAdminIds(env);

  const summary =
    `📋 درخواست عضویت Matrix\n\n` +
    `نام:\n${req.telegram_name || "-"}\n\n` +
    `Username:\n${req.username ? "@" + req.username : "-"}\n\n` +
    `ID:\n${req.user_id}\n\n` +
    `1- اسم گیم:\n${req.game_name}\n\n` +
    `2- اسم واقعی:\n${req.real_name}\n\n` +
    `3-سن:\n${req.age}\n\n` +
    `4 - آیا به صورت مداوم در دولت فعالیت دارید؟\n${req.government_activity}\n\n` +
    `5 - تصاویر:\n${(images.results || []).length} عکس ضمیمه شد\n\n` +
    `6 - معرف:\n${req.family_member ? req.family_member : "پاسخ داده نشد"}\n\n` +
    `7 - دلیل لیو / کیک:\n${req.previous_family_reason}\n\n` +
    `8 - Voice:\nضمیمه شد (${req.voice_duration} ثانیه)\n\n` +
    `Request ID:\n${req.id}\n\n` +
    `تاریخ:\n${req.created_at}`;

  for (const adminId of adminIds) {
    for (const img of images.results || []) {
      await sendPhoto(env, adminId, img.file_id, `Request ID: ${req.id}`);
    }
    if (req.voice_file_id) {
      await sendVoice(env, adminId, req.voice_file_id, `Request ID: ${req.id}`);
    }
    await sendMessage(
      env,
      adminId,
      summary,
      inline([[{ text: "تایید", callback_data: `acc:${req.id}` }, { text: "رد", callback_data: `rej:${req.id}` }]])
    );
  }
}

// ============================================================
// MESSAGE HANDLER
// ============================================================

async function handleMessage(env, ctx, message) {
  const from = message.from;
  if (!from || from.is_bot) return;
  const userId = String(from.id);
  const chatId = message.chat.id;

  const { isNew } = await upsertUser(env, from);
  const admin = await isAdmin(env, userId);

  if (isNew && !admin) {
    const label = `این کاربر ربات رو استارت کرد\n\nنام:\n${[from.first_name, from.last_name].filter(Boolean).join(" ")}\nUsername:\n${from.username ? "@" + from.username : "-"}\nID:\n${userId}`;
    await notifyAdmins(env, label);
  }

  const userRow = await getUser(env, userId);
  if (userRow && userRow.is_banned && !admin) {
    return; // banned users get no response
  }

  const text = (message.text || "").trim();
  const session = await getSession(env, userId);

  // ---- /start ----
  if (text === "/start") {
    await clearSession(env, userId);
    await sendMessage(env, chatId, "به ربات Family Matrix خوش آمدید.", mainMenuKeyboard(admin));
    return;
  }

  // ---- state-driven input takes priority ----
  if (session.state) {
    if (await handleStatefulMessage(env, ctx, message, userId, chatId, session, admin)) return;
  }

  // ---- main menu ----
  if (text === BTN_SUPPORT) {
    await clearSession(env, userId);
    await setSession(env, userId, "support_wait_message", {});
    await sendMessage(env, chatId, MSG_SUPPORT_PROMPT);
    return;
  }

  if (text === BTN_MEMBERSHIP) {
    const enabled = (await getSetting(env, "membership_requests_enabled", "1")) === "1";
    if (!enabled) {
      const reason = await getSetting(env, "membership_disabled_reason", "");
      await sendMessage(env, chatId, `درخواست عضویت در حال حاضر غیرفعال است.\n\nدلیل:\n${reason || "نامشخص"}`);
      return;
    }
    const openReq = await env.DB.prepare(`SELECT id FROM membership_requests WHERE user_id=? AND status='OPEN'`).bind(userId).first();
    if (openReq) {
      await sendMessage(env, chatId, MSG_ALREADY_PENDING);
      return;
    }
    await startMembershipIntro(env, chatId);
    return;
  }

  if (text === BTN_ADMIN_PANEL) {
    if (!admin) return;
    await ensureAdminRow(env, userId, [from.first_name, from.last_name].filter(Boolean).join(" "));
    await sendAdminPanel(env, chatId, userId);
    return;
  }

  // fallback
  await sendMessage(env, chatId, "برای شروع از دکمه‌های زیر استفاده کنید.", mainMenuKeyboard(admin));
}

async function handleStatefulMessage(env, ctx, message, userId, chatId, session, admin) {
  const state = session.state;
  const data = session.data || {};
  const text = (message.text || "").trim();

  // ---- SUPPORT ----
  if (state === "support_wait_message") {
    if (!text) {
      await sendMessage(env, chatId, "لطفا پیام متنی ارسال کنید.");
      return true;
    }
    const user = await getUser(env, userId);
    const t = nowIso();
    const result = await env.DB.prepare(
      `INSERT INTO support_tickets (user_id, username, name, message, status, created_at, updated_at) VALUES (?,?,?,?, 'OPEN', ?, ?)`
    )
      .bind(userId, user ? user.username : "", user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "", text, t, t)
      .run();
    const ticketId = result.meta.last_row_id;
    await env.DB.prepare(`INSERT INTO support_messages (ticket_id, sender_type, sender_id, message, created_at) VALUES (?, 'user', ?, ?, ?)`)
      .bind(ticketId, userId, text, t)
      .run();
    await clearSession(env, userId);
    await sendMessage(env, chatId, "پیام شما دریافت شد و در اسرع وقت پاسخ داده می‌شود.");
    await notifyAdmins(
      env,
      `پیام پشتیبانی جدید\n\nنام:\n${user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "-"}\nUsername:\n${user && user.username ? "@" + user.username : "-"}\nID:\n${userId}\n\nپیام:\n${text}`,
      inline([[{ text: "جواب دادن", callback_data: `supreply:${ticketId}` }]])
    );
    return true;
  }

  // ---- MEMBERSHIP Q1-Q4, Q7 ----
  const simpleSteps = {
    mem_q1: { field: "game_name", next: "mem_q2", nextQ: Q.q2 },
    mem_q2: { field: "real_name", next: "mem_q3", nextQ: Q.q3 },
    mem_q3: { field: "age", next: "mem_q4", nextQ: Q.q4 },
    mem_q4: { field: "government_activity", next: "mem_q5_photos", nextQ: Q.q5 },
    mem_q7: { field: "previous_family_reason", next: "mem_q8", nextQ: Q.q8 },
  };
  if (simpleSteps[state]) {
    if (!text) {
      await sendMessage(env, chatId, "لطفا پاسخ خود را به صورت متن ارسال کنید.");
      return true;
    }
    const step = simpleSteps[state];
    data[step.field] = text;
    await sendMessage(env, chatId, "دریافت شد");
    if (step.next === "mem_q5_photos") data.photos = [];
    await setSession(env, userId, step.next, data);
    if (step.next === "mem_q5_photos") {
      await sendMessage(env, chatId, step.nextQ, inline([[{ text: "ادامه ➡️", callback_data: "mem:photos:continue" }]]));
    } else {
      await sendMessage(env, chatId, step.nextQ);
    }
    return true;
  }

  // ---- MEMBERSHIP Q5 (photos) ----
  if (state === "mem_q5_photos") {
    if (message.photo && message.photo.length > 0) {
      const best = message.photo[message.photo.length - 1];
      data.photos = data.photos || [];
      data.photos.push(best.file_id);
      await setSession(env, userId, "mem_q5_photos", data);
      return true;
    }
    await sendMessage(env, chatId, "لطفا عکس ارسال کنید.", inline([[{ text: "ادامه ➡️", callback_data: "mem:photos:continue" }]]));
    return true;
  }

  // ---- MEMBERSHIP Q6 (optional, text or skip button) ----
  if (state === "mem_q6") {
    if (!text) {
      await sendMessage(env, chatId, "لطفا پاسخ را به صورت متن ارسال کنید یا از دکمه رد شدن استفاده کنید.");
      return true;
    }
    data.family_member = text;
    await sendMessage(env, chatId, "دریافت شد");
    await setSession(env, userId, "mem_q7", data);
    await sendMessage(env, chatId, Q.q7);
    return true;
  }

  // ---- MEMBERSHIP Q8 (voice) ----
  if (state === "mem_q8") {
    if (!message.voice) {
      await sendMessage(env, chatId, "لطفا یک پیام صوتی (ویس) ارسال کنید.");
      return true;
    }
    const duration = message.voice.duration || 0;
    if (duration <= 5) {
      await sendMessage(env, chatId, "ویس شما باید بالای 5 ثانیه باشد. لطفا دوباره ارسال کنید.");
      return true;
    }
    data.voice_file_id = message.voice.file_id;
    data.voice_duration = duration;
    const user = await getUser(env, userId);
    const requestId = await submitMembershipRequest(env, userId, user, data);
    await clearSession(env, userId);
    await sendMessage(env, chatId, MSG_FORM_DONE);
    await sendMembershipRequestToAdmins(env, requestId);
    return true;
  }

  // ---- ADMIN: reply to support ticket ----
  if (state.startsWith("admin_wait_reply:")) {
    if (!admin) return true;
    const ticketId = state.split(":")[1];
    if (!text) {
      await sendMessage(env, chatId, "لطفا پاسخ را به صورت متن ارسال کنید.");
      return true;
    }
    const ticket = await env.DB.prepare(`SELECT * FROM support_tickets WHERE id=?`).bind(ticketId).first();
    if (!ticket) {
      await sendMessage(env, chatId, "این تیکت یافت نشد.");
      await clearSession(env, userId);
      return true;
    }
    const displayName = await getDisplayName(env, userId);
    await sendMessage(env, ticket.user_id, `ادمین ${displayName} به پیام شما پاسخ داد:\n\n${text}`);
    await env.DB.prepare(`UPDATE support_tickets SET status='ANSWERED', updated_at=? WHERE id=?`).bind(nowIso(), ticketId).run();
    await env.DB.prepare(`INSERT INTO support_messages (ticket_id, sender_type, sender_id, message, created_at) VALUES (?, 'admin', ?, ?, ?)`)
      .bind(ticketId, userId, text, nowIso())
      .run();
    await clearSession(env, userId);
    await sendMessage(env, chatId, "پاسخ ارسال شد.");
    await notifyAdmins(env, `ادمین ${displayName} به پیام پشتیبانی ${ticket.name || ticket.user_id} پاسخ داد\n\nپاسخ:\n${text}`);
    return true;
  }

  // ---- ADMIN: reject reason ----
  if (state.startsWith("admin_wait_reject_reason:")) {
    if (!admin) return true;
    const requestId = state.split(":")[1];
    if (!text) {
      await sendMessage(env, chatId, "لطفا دلیل را به صورت متن ارسال کنید.");
      return true;
    }
    const displayName = await getDisplayName(env, userId);
    const upd = await env.DB.prepare(
      `UPDATE membership_requests SET status='REJECTED', reject_reason=?, reviewed_at=?, reviewed_by=?, updated_at=? WHERE id=? AND status='OPEN'`
    )
      .bind(text, nowIso(), userId, nowIso(), requestId)
      .run();
    await clearSession(env, userId);
    if (!upd.meta.changes) {
      await sendMessage(env, chatId, MSG_ALREADY_REVIEWED);
      return true;
    }
    const req = await env.DB.prepare(`SELECT * FROM membership_requests WHERE id=?`).bind(requestId).first();
    await sendMessage(env, req.user_id, `فرم شما رد شد\n\nدلیل:\n${text}`);
    await sendMessage(env, chatId, "درخواست رد شد.");
    await notifyAdmins(env, `ادمین ${displayName} درخواست ${req.telegram_name || req.user_id} رو رد کرد\n\nدلیل:\n${text}`);
    await auditLog(env, "REJECT", userId, displayName, req.user_id, req.telegram_name, text);
    return true;
  }

  // ---- ADMIN: ban ----
  if (state === "admin_wait_ban_id") {
    if (!admin) return true;
    const targetId = text.replace(/[^0-9]/g, "");
    if (!targetId) {
      await sendMessage(env, chatId, "آیدی عددی معتبر ارسال کنید.");
      return true;
    }
    await env.DB.prepare(`UPDATE users SET is_banned=1, updated_at=? WHERE telegram_id=?`).bind(nowIso(), targetId).run();
    await clearSession(env, userId);
    const displayName = await getDisplayName(env, userId);
    await sendMessage(env, chatId, "کاربر بن شد.");
    await notifyAdmins(env, `ادمین ${displayName} کاربر ${targetId} را بن کرد`);
    await auditLog(env, "BAN", userId, displayName, targetId, "", "");
    return true;
  }

  // ---- ADMIN: unban ----
  if (state === "admin_wait_unban_id") {
    if (!admin) return true;
    const targetId = text.replace(/[^0-9]/g, "");
    if (!targetId) {
      await sendMessage(env, chatId, "آیدی عددی معتبر ارسال کنید.");
      return true;
    }
    await env.DB.prepare(`UPDATE users SET is_banned=0, updated_at=? WHERE telegram_id=?`).bind(nowIso(), targetId).run();
    await clearSession(env, userId);
    const displayName = await getDisplayName(env, userId);
    await sendMessage(env, chatId, "کاربر آنبن شد.");
    await notifyAdmins(env, `ادمین ${displayName} کاربر ${targetId} را آنبن کرد`);
    await auditLog(env, "UNBAN", userId, displayName, targetId, "", "");
    return true;
  }

  // ---- ADMIN: broadcast message ----
  if (state === "admin_wait_broadcast_message") {
    if (!admin) return true;
    if (!text) {
      await sendMessage(env, chatId, "لطفا متن پیام همگانی را ارسال کنید.");
      return true;
    }
    data.broadcast_message = text;
    await setSession(env, userId, "admin_wait_broadcast_confirm", data);
    await sendMessage(
      env,
      chatId,
      `پیش‌نمایش پیام همگانی:\n\n${text}`,
      inline([[{ text: "ارسال", callback_data: "bc:send" }, { text: "لغو", callback_data: "bc:cancel" }]])
    );
    return true;
  }

  // ---- ADMIN: disable reason ----
  if (state === "admin_wait_disable_reason") {
    if (!admin) return true;
    if (!text) {
      await sendMessage(env, chatId, "لطفا دلیل را ارسال کنید.");
      return true;
    }
    await setSetting(env, "membership_requests_enabled", "0");
    await setSetting(env, "membership_disabled_reason", text);
    await clearSession(env, userId);
    const displayName = await getDisplayName(env, userId);
    await sendMessage(env, chatId, "درخواست عضویت غیرفعال شد.");
    await notifyAdmins(env, `ادمین ${displayName} درخواست عضویت را غیرفعال کرد\n\nدلیل:\n${text}`);
    await auditLog(env, "MEMBERSHIP_DISABLE", userId, displayName, "", "", text);
    return true;
  }

  // ---- ADMIN: display name change ----
  if (state === "admin_wait_name_change") {
    if (!admin) return true;
    if (!text) {
      await sendMessage(env, chatId, "لطفا نام نمایشی جدید را ارسال کنید.");
      return true;
    }
    await ensureAdminRow(env, userId);
    const oldName = await getDisplayName(env, userId);
    await env.DB.prepare(`UPDATE admins SET display_name=? WHERE telegram_id=?`).bind(text, userId).run();
    await clearSession(env, userId);
    await sendMessage(env, chatId, "نام نمایشی شما بروزرسانی شد.");
    await notifyAdmins(env, `ادمین ${oldName} نام نمایشی خود را به ${text} تغییر داد`);
    await auditLog(env, "ADMIN_NAME_CHANGE", userId, text, userId, oldName, "");
    return true;
  }

  return false;
}

// ============================================================
// ADMIN PANEL
// ============================================================

async function sendAdminPanel(env, chatId, userId) {
  const owner = await isOwner(env, userId);
  const rows = [
    [{ text: "بن کاربر", callback_data: "adm:ban" }, { text: "آنبن کاربر", callback_data: "adm:unban" }],
    [{ text: "پیام همگانی", callback_data: "adm:broadcast" }],
    [{ text: "تغییرات ربات", callback_data: "adm:settings" }],
    [{ text: "تغییر اسم ادمین", callback_data: "adm:namechange" }],
    [{ text: "درخواست های جواب داده نشده", callback_data: "adm:unanswered_mem" }],
    [{ text: "پیام پشتیبانی های جواب داده نشده", callback_data: "adm:unanswered_sup" }],
    [{ text: "خالی کردن درخواست ها و پیام های پشتیبانی", callback_data: "adm:clear" }],
  ];
  if (owner) rows.push([{ text: "ریست", callback_data: "adm:reset" }]);
  await sendMessage(env, chatId, "پنل مدیریت:", inline(rows));
}

// ============================================================
// CALLBACK HANDLER
// ============================================================

async function handleCallback(env, ctx, cq) {
  const from = cq.from;
  const userId = String(from.id);
  const chatId = cq.message ? cq.message.chat.id : from.id;
  const data = cq.data || "";

  const userRow = await getUser(env, userId);
  const admin = await isAdmin(env, userId);
  if (userRow && userRow.is_banned && !admin) {
    await answerCallback(env, cq.id, "دسترسی ندارید.", true);
    return;
  }

  // ---- membership form callbacks (any user) ----
  if (data === "mem:accept") {
    await answerCallback(env, cq.id);
    const openReq = await env.DB.prepare(`SELECT id FROM membership_requests WHERE user_id=? AND status='OPEN'`).bind(userId).first();
    if (openReq) {
      await sendMessage(env, chatId, MSG_ALREADY_PENDING);
      return;
    }
    await beginMembershipForm(env, userId);
    return;
  }

  if (data === "mem:photos:continue") {
    const session = await getSession(env, userId);
    if (session.state !== "mem_q5_photos") {
      await answerCallback(env, cq.id);
      return;
    }
    const photos = (session.data && session.data.photos) || [];
    if (photos.length === 0) {
      await answerCallback(env, cq.id, "لطفا حداقل یک عکس ارسال کنید.", true);
      return;
    }
    await answerCallback(env, cq.id);
    await sendMessage(env, chatId, "دریافت شد");
    await setSession(env, userId, "mem_q6", session.data);
    await sendMessage(env, chatId, Q.q6, inline([[{ text: "رد شدن از این سوال", callback_data: "mem:q6:skip" }]]));
    return;
  }

  if (data === "mem:q6:skip") {
    const session = await getSession(env, userId);
    if (session.state !== "mem_q6") {
      await answerCallback(env, cq.id);
      return;
    }
    await answerCallback(env, cq.id);
    session.data.family_member = "";
    await setSession(env, userId, "mem_q7", session.data);
    await sendMessage(env, chatId, Q.q7);
    return;
  }

  // ---- everything below requires admin ----
  if (data.startsWith("adm:") || data.startsWith("acc:") || data.startsWith("rej:") || data.startsWith("supreply:") ||
      data.startsWith("supview:") || data.startsWith("admview:") || data.startsWith("bc:")) {
    if (!admin) {
      await answerCallback(env, cq.id, "شما دسترسی ادمین ندارید.", true);
      return;
    }
  }

  await ensureAdminRow(env, userId, [from.first_name, from.last_name].filter(Boolean).join(" "));
  const displayName = await getDisplayName(env, userId);

  // ---- accept / reject ----
  if (data.startsWith("acc:")) {
    const requestId = data.split(":")[1];
    await answerCallback(env, cq.id);
    const upd = await env.DB.prepare(
      `UPDATE membership_requests SET status='APPROVED', reviewed_at=?, reviewed_by=?, updated_at=? WHERE id=? AND status='OPEN'`
    )
      .bind(nowIso(), userId, nowIso(), requestId)
      .run();
    if (!upd.meta.changes) {
      await sendMessage(env, chatId, MSG_ALREADY_REVIEWED);
      return;
    }
    const req = await env.DB.prepare(`SELECT * FROM membership_requests WHERE id=?`).bind(requestId).first();
    await sendMessage(env, req.user_id, MSG_APPROVED_USER);
    await sendMessage(env, chatId, "درخواست تایید شد.");
    await notifyAdmins(env, `ادمین ${displayName} درخواست ${req.telegram_name || req.user_id} رو برای ورود به فمیلی قبول کرد`);
    await auditLog(env, "ACCEPT", userId, displayName, req.user_id, req.telegram_name, "");
    return;
  }

  if (data.startsWith("rej:")) {
    const requestId = data.split(":")[1];
    const req = await env.DB.prepare(`SELECT * FROM membership_requests WHERE id=?`).bind(requestId).first();
    if (!req || req.status !== "OPEN") {
      await answerCallback(env, cq.id, MSG_ALREADY_REVIEWED, true);
      return;
    }
    await answerCallback(env, cq.id);
    await setSession(env, userId, `admin_wait_reject_reason:${requestId}`, {});
    await sendMessage(env, chatId, MSG_REJECT_REASON_PROMPT);
    return;
  }

  // ---- support reply ----
  if (data.startsWith("supreply:")) {
    const ticketId = data.split(":")[1];
    await answerCallback(env, cq.id);
    await setSession(env, userId, `admin_wait_reply:${ticketId}`, {});
    await sendMessage(env, chatId, "لطفا پاسخ خود را ارسال کنید.");
    return;
  }

  // ---- admin panel top level ----
  if (data === "adm:ban") {
    await answerCallback(env, cq.id);
    await setSession(env, userId, "admin_wait_ban_id", {});
    await sendMessage(env, chatId, "آیدی عددی تلگرام کاربر را ارسال کنید.");
    return;
  }
  if (data === "adm:unban") {
    await answerCallback(env, cq.id);
    await setSession(env, userId, "admin_wait_unban_id", {});
    await sendMessage(env, chatId, "آیدی عددی تلگرام کاربر را ارسال کنید.");
    return;
  }
  if (data === "adm:broadcast") {
    await answerCallback(env, cq.id);
    await setSession(env, userId, "admin_wait_broadcast_message", {});
    await sendMessage(env, chatId, "متن پیام همگانی را ارسال کنید.");
    return;
  }
  if (data === "adm:settings") {
    await answerCallback(env, cq.id);
    await sendMessage(
      env,
      chatId,
      "تغییرات ربات:",
      inline([[{ text: "فعال کردن درخواست عضویت", callback_data: "adm:settings:enable" }], [{ text: "غیرفعال کردن درخواست عضویت", callback_data: "adm:settings:disable" }]])
    );
    return;
  }
  if (data === "adm:settings:enable") {
    await answerCallback(env, cq.id);
    await setSetting(env, "membership_requests_enabled", "1");
    await setSetting(env, "membership_disabled_reason", "");
    await sendMessage(env, chatId, "فعال شد.");
    await notifyAdmins(env, `ادمین ${displayName} درخواست عضویت را فعال کرد`);
    await auditLog(env, "MEMBERSHIP_ENABLE", userId, displayName, "", "", "");
    return;
  }
  if (data === "adm:settings:disable") {
    await answerCallback(env, cq.id);
    await setSession(env, userId, "admin_wait_disable_reason", {});
    await sendMessage(env, chatId, MSG_DISABLE_REASON_PROMPT);
    return;
  }
  if (data === "adm:namechange") {
    await answerCallback(env, cq.id);
    await setSession(env, userId, "admin_wait_name_change", {});
    await sendMessage(env, chatId, "نام نمایشی جدید را ارسال کنید.");
    return;
  }
  if (data === "adm:unanswered_mem") {
    await answerCallback(env, cq.id);
    const rows = await env.DB.prepare(`SELECT id, telegram_name, user_id FROM membership_requests WHERE status='OPEN' ORDER BY created_at LIMIT 30`).all();
    const list = rows.results || [];
    if (list.length === 0) {
      await sendMessage(env, chatId, "درخواستی وجود ندارد.");
      return;
    }
    const kb = list.map((r) => [{ text: `درخواست ${r.telegram_name || r.user_id} #${r.id}`, callback_data: `admview:${r.id}` }]);
    await sendMessage(env, chatId, "درخواست‌های جواب داده نشده:", inline(kb));
    return;
  }
  if (data === "adm:unanswered_sup") {
    await answerCallback(env, cq.id);
    const rows = await env.DB.prepare(`SELECT id, name, user_id FROM support_tickets WHERE status='OPEN' ORDER BY created_at LIMIT 30`).all();
    const list = rows.results || [];
    if (list.length === 0) {
      await sendMessage(env, chatId, "پیامی وجود ندارد.");
      return;
    }
    const kb = list.map((r) => [{ text: `پیام ${r.name || r.user_id} #${r.id}`, callback_data: `supview:${r.id}` }]);
    await sendMessage(env, chatId, "پیام‌های پشتیبانی جواب داده نشده:", inline(kb));
    return;
  }
  if (data.startsWith("admview:")) {
    const requestId = data.split(":")[1];
    await answerCallback(env, cq.id);
    const req = await env.DB.prepare(`SELECT * FROM membership_requests WHERE id=?`).bind(requestId).first();
    if (!req) {
      await sendMessage(env, chatId, "یافت نشد.");
      return;
    }
    const summary =
      `📋 درخواست عضویت Matrix\n\nنام:\n${req.telegram_name}\nUsername:\n${req.username ? "@" + req.username : "-"}\nID:\n${req.user_id}\n\n` +
      `1- اسم گیم:\n${req.game_name}\n\n2- اسم واقعی:\n${req.real_name}\n\n3-سن:\n${req.age}\n\n` +
      `4 - آیا به صورت مداوم در دولت فعالیت دارید؟\n${req.government_activity}\n\n6 - معرف:\n${req.family_member || "پاسخ داده نشد"}\n\n` +
      `7 - دلیل لیو / کیک:\n${req.previous_family_reason}\n\nوضعیت: ${req.status}\n\nRequest ID:\n${req.id}`;
    await sendMessage(env, chatId, summary, req.status === "OPEN" ? inline([[{ text: "تایید", callback_data: `acc:${req.id}` }, { text: "رد", callback_data: `rej:${req.id}` }]]) : undefined);
    return;
  }
  if (data.startsWith("supview:")) {
    const ticketId = data.split(":")[1];
    await answerCallback(env, cq.id);
    const ticket = await env.DB.prepare(`SELECT * FROM support_tickets WHERE id=?`).bind(ticketId).first();
    if (!ticket) {
      await sendMessage(env, chatId, "یافت نشد.");
      return;
    }
    const summary = `نام: ${ticket.name || "-"}\nUsername: ${ticket.username ? "@" + ticket.username : "-"}\nID: ${ticket.user_id}\n\nپیام:\n${ticket.message}\n\nوضعیت: ${ticket.status}`;
    await sendMessage(env, chatId, summary, ticket.status === "OPEN" ? inline([[{ text: "جواب دادن", callback_data: `supreply:${ticket.id}` }]]) : undefined);
    return;
  }
  if (data === "adm:clear") {
    await answerCallback(env, cq.id);
    await sendMessage(env, chatId, "آیا مطمئن هستید؟ لیست درخواست‌ها و پیام‌های در انتظار بازسازی می‌شود (هیچ داده تاریخی حذف نمی‌شود).", inline([[{ text: "بله", callback_data: "adm:clear:confirm" }, { text: "لغو", callback_data: "adm:clear:cancel" }]]));
    return;
  }
  if (data === "adm:clear:cancel") {
    await answerCallback(env, cq.id, "لغو شد.");
    return;
  }
  if (data === "adm:clear:confirm") {
    await answerCallback(env, cq.id);
    await sendMessage(env, chatId, "انجام شد.");
    await notifyAdmins(env, `ادمین ${displayName} لیست درخواست‌ها و پیام‌های در انتظار را بازسازی کرد`);
    await auditLog(env, "CLEAR", userId, displayName, "", "", "");
    return;
  }
  if (data === "adm:reset") {
    if (!(await isOwner(env, userId))) {
      await answerCallback(env, cq.id, "فقط مالک می‌تواند ریست کند.", true);
      return;
    }
    await answerCallback(env, cq.id);
    await sendMessage(env, chatId, "آیا مطمئن هستید؟ این عملیات تمام درخواست‌ها، کاربران و پیام‌های پشتیبانی را پاک می‌کند.", inline([[{ text: "بله، ادامه", callback_data: "adm:reset:confirm1" }, { text: "لغو", callback_data: "adm:reset:cancel" }]]));
    return;
  }
  if (data === "adm:reset:cancel") {
    await answerCallback(env, cq.id, "لغو شد.");
    return;
  }
  if (data === "adm:reset:confirm1") {
    if (!(await isOwner(env, userId))) {
      await answerCallback(env, cq.id, "فقط مالک می‌تواند ریست کند.", true);
      return;
    }
    await answerCallback(env, cq.id);
    await sendMessage(env, chatId, "این عملیات غیرقابل بازگشت است. تایید نهایی؟", inline([[{ text: "تایید نهایی", callback_data: "adm:reset:confirm2" }, { text: "لغو", callback_data: "adm:reset:cancel" }]]));
    return;
  }
  if (data === "adm:reset:confirm2") {
    if (!(await isOwner(env, userId))) {
      await answerCallback(env, cq.id, "فقط مالک می‌تواند ریست کند.", true);
      return;
    }
    await answerCallback(env, cq.id);
    await performReset(env);
    await sendMessage(env, chatId, "دریافت شد و ربات ریست شد");
    await auditLog(env, "RESET", userId, displayName, "", "", "");
    return;
  }

  // ---- broadcast confirm ----
  if (data === "bc:cancel") {
    await answerCallback(env, cq.id, "لغو شد.");
    await clearSession(env, userId);
    return;
  }
  if (data === "bc:send") {
    const session = await getSession(env, userId);
    const msg = session.data && session.data.broadcast_message;
    if (!msg) {
      await answerCallback(env, cq.id);
      return;
    }
    await answerCallback(env, cq.id, "پخش پیام شروع شد.");
    await clearSession(env, userId);
    const users = await env.DB.prepare(`SELECT telegram_id FROM users WHERE is_banned=0`).all();
    const list = users.results || [];
    const t = nowIso();
    const bc = await env.DB.prepare(`INSERT INTO broadcasts (message, status, total, success, failed, created_at) VALUES (?, 'in_progress', ?, 0, 0, ?)`)
      .bind(msg, list.length, t)
      .run();
    const broadcastId = bc.meta.last_row_id;
    for (const u of list) {
      await env.DB.prepare(`INSERT INTO broadcast_recipients (broadcast_id, user_id, status, created_at) VALUES (?,?, 'pending', ?)`).bind(broadcastId, u.telegram_id, t).run();
    }
    await sendMessage(env, chatId, `پخش پیام برای ${list.length} کاربر آغاز شد.`);
    await notifyAdmins(env, `ادمین ${displayName} یک پیام همگانی ارسال کرد`);
    await auditLog(env, "BROADCAST", userId, displayName, "", "", msg);
    ctx.waitUntil(processBroadcastBatch(env, broadcastId));
    return;
  }
}

async function performReset(env) {
  await env.DB.prepare(`DELETE FROM users`).run();
  await env.DB.prepare(`DELETE FROM membership_requests`).run();
  await env.DB.prepare(`DELETE FROM membership_request_images`).run();
  await env.DB.prepare(`DELETE FROM form_sessions`).run();
  await env.DB.prepare(`DELETE FROM support_tickets`).run();
  await env.DB.prepare(`DELETE FROM support_messages`).run();
  await env.DB.prepare(`DELETE FROM broadcasts`).run();
  await env.DB.prepare(`DELETE FROM broadcast_recipients`).run();
  await setSetting(env, "membership_requests_enabled", "1");
  await setSetting(env, "membership_disabled_reason", "");
}

// ============================================================
// BROADCAST PROCESSING (resumable, no queue required)
// ============================================================

async function processBroadcastBatch(env, broadcastId) {
  const BATCH_SIZE = 20;
  const MAX_BATCHES_PER_CALL = 10; // ~200 messages per invocation, then resumes on next webhook call
  let batches = 0;
  while (batches < MAX_BATCHES_PER_CALL) {
    const pending = await env.DB.prepare(`SELECT id, user_id FROM broadcast_recipients WHERE broadcast_id=? AND status='pending' LIMIT ?`)
      .bind(broadcastId, BATCH_SIZE)
      .all();
    const list = pending.results || [];
    if (list.length === 0) break;
    const bc = await env.DB.prepare(`SELECT message FROM broadcasts WHERE id=?`).bind(broadcastId).first();
    for (const r of list) {
      let ok = false;
      try {
        const res = await sendMessage(env, r.user_id, bc ? bc.message : "");
        ok = !!(res && res.ok);
      } catch (e) {
        ok = false;
      }
      await env.DB.prepare(`UPDATE broadcast_recipients SET status=? WHERE id=?`).bind(ok ? "sent" : "failed", r.id).run();
      await env.DB.prepare(`UPDATE broadcasts SET success = success + ?, failed = failed + ? WHERE id=?`).bind(ok ? 1 : 0, ok ? 0 : 1, broadcastId).run();
    }
    batches++;
  }
  const remaining = await env.DB.prepare(`SELECT COUNT(*) as c FROM broadcast_recipients WHERE broadcast_id=? AND status='pending'`).bind(broadcastId).first();
  if (!remaining || remaining.c === 0) {
    await env.DB.prepare(`UPDATE broadcasts SET status='completed', finished_at=? WHERE id=?`).bind(nowIso(), broadcastId).run();
  }
}

async function continueInProgressBroadcasts(env, ctx) {
  const rows = await env.DB.prepare(`SELECT id FROM broadcasts WHERE status='in_progress' LIMIT 3`).all();
  for (const r of rows.results || []) {
    ctx.waitUntil(processBroadcastBatch(env, r.id));
  }
}

// ============================================================
// TOP LEVEL UPDATE HANDLER
// ============================================================

async function handleUpdateSafe(env, ctx, update) {
  try {
    await continueInProgressBroadcasts(env, ctx);
    if (update.message) {
      await handleMessage(env, ctx, update.message);
    } else if (update.callback_query) {
      await handleCallback(env, ctx, update.callback_query);
    }
  } catch (e) {
    console.log("handleUpdate error:", e && e.stack ? e.stack : e);
  }
}

// ============================================================
// HTTP ENTRY POINT
// ============================================================

export default {
  async fetch(request, env, ctx) {
    let url;
    try {
      url = new URL(request.url);
    } catch (e) {
      return new Response("Bad Request", { status: 400 });
    }

    try {
      await ensureDb(env);
    } catch (e) {
      return new Response("Database initialization error: " + e.message, { status: 500 });
    }

    if (url.pathname === "/setup" && request.method === "GET") {
      const token = url.searchParams.get("token");
      if (!env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("TELEGRAM_WEBHOOK_SECRET secret is not set.", { status: 500 });
      }
      if (!env.TELEGRAM_BOT_TOKEN) {
        return new Response("TELEGRAM_BOT_TOKEN secret is not set.", { status: 500 });
      }
      if (!env.OWNER_TELEGRAM_ID) {
        return new Response("OWNER_TELEGRAM_ID secret is not set.", { status: 500 });
      }
      if (token !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      const webhookUrl = `${url.origin}/telegram/webhook`;
      const res = await tgApi(env, "setWebhook", { url: webhookUrl, secret_token: env.TELEGRAM_WEBHOOK_SECRET });
      return new Response(JSON.stringify(res, null, 2), { headers: { "content-type": "application/json" } });
    }

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      const secret = request.headers.get("x-telegram-bot-api-secret-token");
      if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      let update;
      try {
        update = await request.json();
      } catch (e) {
        return new Response("Bad Request", { status: 400 });
      }
      ctx.waitUntil(handleUpdateSafe(env, ctx, update));
      return new Response("OK");
    }

    return new Response("Matrix Family Bot is running.");
  },
};
