import os
import json
import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton

BOT_TOKEN = os.getenv("BOT_TOKEN")

if not BOT_TOKEN:
    raise Exception("BOT_TOKEN is missing!")

bot = telebot.TeleBot(BOT_TOKEN)

ADMIN_ID = 8213353193
DB_FILE = "db.json"

def load_db():
    try:
        with open(DB_FILE, "r") as f:
            return json.load(f)
    except:
        return {}

def save_db(db):
    with open(DB_FILE, "w") as f:
        json.dump(db, f, indent=2)

db = load_db()

def get_user(uid):
    uid = str(uid)
    if uid not in db:
        db[uid] = {"points": 0, "rank": "New", "banned": False}
    return db[uid]

def calc_rank(points):
    if points >= 2000: return "Gunner"
    if points >= 1100: return "Lieutenant"
    if points >= 600: return "Soldier"
    if points >= 250: return "Diamond"
    if points >= 100: return "Silver"
    if points >= 50: return "Bronze"
    return "New"

def is_banned(uid):
    return db.get(str(uid), {}).get("banned", False)

@bot.message_handler(commands=['start'])
def start(message):
    uid = str(message.from_user.id)
    user = get_user(uid)
    save_db(db)

    if user["banned"]:
        bot.send_message(message.chat.id, "⛔ شما بن هستید")
        return

    markup = InlineKeyboardMarkup()
    markup.add(
        InlineKeyboardButton("💰 امتیاز", callback_data="points"),
        InlineKeyboardButton("🏆 لیدر", callback_data="leader")
    )
    markup.add(
        InlineKeyboardButton("📩 درخواست امتیاز", callback_data="req"),
        InlineKeyboardButton("ℹ️ About", callback_data="about")
    )

    bot.send_message(message.chat.id, "👋 خوش آمدید", reply_markup=markup)

@bot.callback_query_handler(func=lambda call: True)
def callback(call):
    uid = str(call.from_user.id)
    user = get_user(uid)

    if user["banned"]:
        return

    if call.data == "points":
        bot.send_message(call.message.chat.id,
                         f"💰 امتیاز: {user['points']}
🏆 رنک: {user['rank']}")

    elif call.data == "leader":
        sorted_db = sorted(db.items(), key=lambda x: x[1]["points"], reverse=True)
        text = "🏆 Leaderboard:

"
        for i, (uid, data) in enumerate(sorted_db[:10]):
            text += f"{i+1}. {uid} | {data['points']}P | {data['rank']}
"
        bot.send_message(call.message.chat.id, text)

    elif call.data == "about":
        bot.send_message(call.message.chat.id, "🤖 Bot System")

    elif call.data == "req":
        bot.send_message(call.message.chat.id, "📩 عکس + توضیح بفرست")

@bot.message_handler(content_types=['photo'])
def handle_photo(message):
    uid = str(message.from_user.id)
    user = get_user(uid)

    if user["banned"]:
        return

    caption = message.caption or "بدون توضیح"

    markup = InlineKeyboardMarkup()
    markup.add(
        InlineKeyboardButton("✔️ قبول", callback_data=f"ok_{uid}"),
        InlineKeyboardButton("❌ رد", callback_data=f"no_{uid}")
    )

    bot.send_message(
        ADMIN_ID,
        f"📩 درخواست از {uid}

{caption}",
        reply_markup=markup
    )

@bot.callback_query_handler(func=lambda call: call.data.startswith(("ok_", "no_")))
def admin(call):
    if call.from_user.id != ADMIN_ID:
        return

    action, uid = call.data.split("_")
    uid = str(uid)

    if uid not in db:
        db[uid] = {"points": 0, "rank": "New", "banned": False}

    if action == "ok":
        db[uid]["points"] += 50
        db[uid]["rank"] = calc_rank(db[uid]["points"])
        bot.send_message(uid, "✅ +50 امتیاز")

    else:
        bot.send_message(uid, "❌ رد شد")

    save_db(db)

print("Bot running...")
bot.infinity_polling()
