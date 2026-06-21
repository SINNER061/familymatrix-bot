import os
import random
import sqlite3
import telebot

BOT_TOKEN = os.getenv("BOT_TOKEN")
OWNER_ID = 8213353193

bot = telebot.TeleBot(BOT_TOKEN)

# DB
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

RANKS = [
    ("New", 0),
    ("Bronze", 100),
    ("Silver", 170),
    ("Gold", 250),
    ("Diamond", 350),
    ("Sentry", 470),
    ("Soldier", 600),
    ("Colonel", 1100),
    ("Brigadier", 4000),
]

def get_rank(points):
    rank = "New"
    for r, p in RANKS:
        if points >= p:
            rank = r
    return rank

def add_user(uid, username):
    cur.execute("INSERT OR IGNORE INTO users VALUES (?, ?, 0, 'New')", (uid, username))
    conn.commit()

def update(uid):
    cur.execute("SELECT points FROM users WHERE user_id=?", (uid,))
    p = cur.fetchone()[0]
    r = get_rank(p)
    cur.execute("UPDATE users SET rank=? WHERE user_id=?", (r, uid))
    conn.commit()

# START
@bot.message_handler(commands=['start'])
def start(m):
    add_user(m.from_user.id, m.from_user.username)
    bot.send_message(m.chat.id, "👋 Welcome Family Matrix Bot")

# LEADERBOARD
@bot.message_handler(commands=['leaderboard'])
def lb(m):
    cur.execute("SELECT username, points, rank FROM users ORDER BY points DESC")
    rows = cur.fetchall()

    text = "🏆 Leaderboard:\n\n"
    for i, r in enumerate(rows, 1):
        text += f"{i}. @{r[0]} | {r[2]} | {r[1]}P\n"

    bot.send_message(m.chat.id, text)

# BETTING
@bot.message_handler(commands=['bet'])
def bet(m):
    try:
        target = m.text.split()[1].replace("@", "")
        amount = int(m.text.split()[2])

        cur.execute("SELECT user_id FROM users WHERE username=?", (target,))
        t = cur.fetchone()

        if not t:
            return bot.reply_to(m, "User not found")

        winner = random.choice([m.from_user.id, t[0]])

        if winner == m.from_user.id:
            cur.execute("UPDATE users SET points = points + ? WHERE user_id=?", (amount, m.from_user.id))
            cur.execute("UPDATE users SET points = points - ? WHERE user_id=?", (amount, t[0]))
            bot.send_message(m.chat.id, f"🏆 You won +{amount}")
        else:
            cur.execute("UPDATE users SET points = points - ? WHERE user_id=?", (amount, m.from_user.id))
            cur.execute("UPDATE users SET points = points + ? WHERE user_id=?", (amount, t[0]))
            bot.send_message(m.chat.id, f"❌ You lost -{amount}")

        conn.commit()

    except:
        bot.reply_to(m, "Use: /bet @user amount")

print("Bot running...")
bot.infinity_polling()
