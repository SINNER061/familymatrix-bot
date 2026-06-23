import os
import json
import telebot
from telebot.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton
)

# ========================
# CONFIG
# ========================

BOT_TOKEN = os.environ.get("BOT_TOKEN")

if not BOT_TOKEN:
    raise Exception("BOT_TOKEN environment variable not found")

ADMIN_ID = 8213353193
DB = "db.json"

bot = telebot.TeleBot(BOT_TOKEN)


# ========================
# DATABASE
# ========================

def load():
    try:
        with open(DB, "r", encoding="utf8") as f:
            return json.load(f)
    except:
        return {}

def save(data):
    with open(DB, "w", encoding="utf8") as f:
        json.dump(
            data,
            f,
            ensure_ascii=False,
            indent=2
        )

users = load()


def user(uid):

    uid = str(uid)

    if uid not in users:

        users[uid] = {
            "points": 0,
            "rank": "New"
        }

    return users[uid]


def rank(score):

    if score >= 1000:
        return "👑 Legend"

    if score >= 500:
        return "💎 Diamond"

    if score >= 250:
        return "🥈 Silver"

    if score >= 100:
        return "🥉 Bronze"

    return "🆕 New"


# ========================
# START
# ========================

@bot.message_handler(commands=["start"])
def start(msg):

    u = user(msg.from_user.id)

    kb = InlineKeyboardMarkup()

    kb.row(
        InlineKeyboardButton(
            "💰 امتیاز من",
            callback_data="points"
        )
    )

    kb.row(
        InlineKeyboardButton(
            "📩 درخواست امتیاز",
            callback_data="request"
        )
    )

    kb.row(
        InlineKeyboardButton(
            "🏆 لیدربورد",
            callback_data="leader"
        )
    )

    bot.send_message(
        msg.chat.id,
        f"""
👋 خوش اومدی

🏅 رنک:
{u["rank"]}

امتیاز:
{u["points"]}
""",
        reply_markup=kb
    )


# ========================
# BUTTONS
# ========================

@bot.callback_query_handler(func=lambda c: True)
def click(call):

    uid = call.from_user.id

    if call.data == "points":

        u = user(uid)

        bot.answer_callback_query(
            call.id,
            f'''
💰 {u["points"]}

🏅 {u["rank"]}
'''
        )

    elif call.data == "leader":

        top = sorted(
            users.items(),
            key=lambda x: x[1]["points"],
            reverse=True
        )[:10]

        text = "🏆 لیدربورد\n\n"

        for i, (uid, info) in enumerate(top):

            text += (
                f"{i+1}. "
                f"{info['points']} "
                f"| "
                f"{info['rank']}\n"
            )

        bot.send_message(
            call.message.chat.id,
            text
        )

    elif call.data == "request":

        bot.send_message(
            call.message.chat.id,
"""
📩 فرم درخواست امتیاز

👤 نام کاربری:

🎯 فعالیت:

📝 توضیحات:

📎 مدرک:

💰 امتیاز درخواستی:

ارسال کن تا ادمین بررسی کند.
"""
        )


# ========================
# REQUEST
# ========================

@bot.message_handler(
    func=lambda m:
    "امتیاز درخواستی" in m.text
)
def req(msg):

    text = f"""
📩 درخواست جدید

از:
{msg.from_user.id}

متن:

{msg.text}
"""

    bot.send_message(
        ADMIN_ID,
        text
    )

    bot.reply_to(
        msg,
        "✅ درخواست ثبت شد"
    )


# ========================
# ADMIN
# ========================

@bot.message_handler(
    commands=["add"]
)
def add(msg):

    if msg.from_user.id != ADMIN_ID:
        return

    try:

        _, uid, pts = (
            msg.text.split()
        )

        pts = int(pts)

        u = user(uid)

        u["points"] += pts

        u["rank"] = rank(
            u["points"]
        )

        save(users)

        bot.send_message(
            uid,
            f"""
🎉

+{pts}

امتیاز گرفتی

🏅
{u["rank"]}
"""
        )

        bot.reply_to(
            msg,
            "✅ ثبت شد"
        )

    except:

        bot.reply_to(
            msg,
            "/add user_id points"
        )


print("Bot running...")

bot.infinity_polling(
    timeout=60,
    long_polling_timeout=60
)
