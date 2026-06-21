import os
import random
import sqlite3
from telegram import Update, ReplyKeyboardMarkup, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters

# ======================
# OWNER
# ======================
OWNER_ID = 8213353193
BOT_TOKEN = os.getenv("BOT_TOKEN")

# ======================
# DB
# ======================
conn = sqlite3.connect("family.db", check_same_thread=False)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    points INTEGER DEFAULT 0,
    rank TEXT DEFAULT 'New'
)
""")
conn.commit()

# ======================
# RANK SYSTEM
# ======================
RANKS = [
    ("New", 0),
    ("Member", 50),
    ("Bronze", 100),
    ("Silver", 170),
    ("Gold", 250),
    ("Diamond", 350),
    ("Sentry", 470),
    ("Soldier", 600),
    ("Grenadier", 750),
    ("Sergeant", 900),
    ("Colonel", 1100),
    ("Lieutenant", 1350),
    ("Ranger", 1650),
    ("Fusilier", 2000),
    ("Gunner", 2400),
    ("Marine", 2850),
    ("Major", 3400),
    ("Brigadier", 4000),
]

def get_rank(points):
    rank = "New"
    for r, p in RANKS:
        if points >= p:
            rank = r
    return rank

# ======================
# USER HELPERS
# ======================
def add_user(user_id, username):
    cur.execute("INSERT OR IGNORE INTO users (user_id, username, points, rank) VALUES (?, ?, 0, 'New')",
                (user_id, username))
    conn.commit()

def update_rank(user_id):
    cur.execute("SELECT points FROM users WHERE user_id=?", (user_id,))
    points = cur.fetchone()[0]
    rank = get_rank(points)
    cur.execute("UPDATE users SET rank=? WHERE user_id=?", (rank, user_id))
    conn.commit()
    return rank, points

# ======================
# UI
# ======================
keyboard = ReplyKeyboardMarkup([
    ["🏆 Ranks", "⭐ Request Points"],
    ["🎲 Betting", "📊 Leaderboard"],
    ["ℹ️ About"]
], resize_keyboard=True)

# ======================
# START
# ======================
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    add_user(user.id, user.username)

    await update.message.reply_text(
        "👋 Welcome to Family Matrix Bot\nChoose an option:",
        reply_markup=keyboard
    )

# ======================
# RANK LIST
# ======================
async def ranks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = "🏆 Family Ranks:\n\n"
    for r, p in RANKS:
        text += f"{r} → {p} P\n"
    await update.message.reply_text(text)

# ======================
# MY INFO
# ======================
async def leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    cur.execute("SELECT username, points, rank FROM users ORDER BY points DESC")
    rows = cur.fetchall()

    text = "🏆 Leaderboard:\n\n"
    for i, r in enumerate(rows, 1):
        text += f"{i}. @{r[0]} | {r[2]} | {r[1]}P\n"

    await update.message.reply_text(text)

# ======================
# ABOUT
# ======================
async def about(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Family Matrix Bot\n\n"
        "Point & Rank Management System\n"
        "Developed by Sepahr (Matrix)\n"
        "@oovqx"
    )

# ======================
# REQUEST POINTS (SIMPLIFIED)
# ======================
pending_requests = {}

async def request_points(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📩 Send request like:\n\n#Gun1K  \n(with proof photo)"
    )

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    if update.message.photo:
        caption = update.message.caption or ""
        file_id = update.message.photo[-1].file_id

        if user.id not in pending_requests:
            pending_requests[user.id] = []

        pending_requests[user.id].append((caption, file_id))

        if user.id != OWNER_ID:
            keyboard_admin = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("✅ Accept", callback_data=f"acc_{user.id}"),
                    InlineKeyboardButton("❌ Reject", callback_data=f"rej_{user.id}")
                ]
            ])

            await context.bot.send_photo(
                OWNER_ID,
                file_id,
                caption=f"📩 Request from @{user.username}\nTag: {caption}",
                reply_markup=keyboard_admin
            )

        await update.message.reply_text("📨 Request sent to admin!")

# ======================
# ADMIN RESPONSE
# ======================
async def button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    data = query.data
    action, uid = data.split("_")
    uid = int(uid)

    if action == "acc":
        cur.execute("UPDATE users SET points = points + 50 WHERE user_id=?", (uid,))
        conn.commit()
        rank, pts = update_rank(uid)

        await context.bot.send_message(uid, f"✅ Accepted!\n+50 Points\nRank: {rank} ({pts})")

        await query.edit_message_caption("✅ Approved")

    elif action == "rej":
        await context.bot.send_message(uid, "❌ Your request was rejected by admin.")
        await query.edit_message_caption("❌ Rejected")

# ======================
# BETTING (SIMPLE FULL TRANSFER)
# ======================
async def betting(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🎲 Betting format:\n\n/bet @username amount"
    )

async def bet(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    if len(context.args) < 2:
        return await update.message.reply_text("Usage: /bet @user amount")

    target = context.args[0].replace("@", "")
    amount = int(context.args[1])

    cur.execute("SELECT user_id FROM users WHERE username=?", (target,))
    row = cur.fetchone()

    if not row:
        return await update.message.reply_text("User not found")

    target_id = row[0]

    winner = random.choice([user.id, target_id])

    if winner == user.id:
        cur.execute("UPDATE users SET points = points + ? WHERE user_id=?", (amount, user.id))
        cur.execute("UPDATE users SET points = points - ? WHERE user_id=?", (amount, target_id))
        conn.commit()

        await update.message.reply_text(f"🏆 You won +{amount}")

        await context.bot.send_message(target_id, f"❌ You lost -{amount}")

    else:
        cur.execute("UPDATE users SET points = points + ? WHERE user_id=?", (amount, target_id))
        cur.execute("UPDATE users SET points = points - ? WHERE user_id=?", (amount, user.id))
        conn.commit()

        await update.message.reply_text(f"❌ You lost -{amount}")
        await context.bot.send_message(target_id, f"🏆 You won +{amount}")

# ======================
# ROUTER
# ======================
async def router(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text

    if text == "🏆 Ranks":
        return await ranks(update, context)

    if text == "⭐ Request Points":
        return await request_points(update, context)

    if text == "🎲 Betting":
        return await betting(update, context)

    if text == "📊 Leaderboard":
        return await leaderboard(update, context)

    if text == "ℹ️ About":
        return await about(update, context)

    await handle_text(update, context)

# ======================
# MAIN
# ======================
def main():
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("bet", bet))
    app.add_handler(CallbackQueryHandler(button))
    app.add_handler(MessageHandler(filters.ALL, router))

    app.run_polling()

if __name__ == "__main__":
    main()
