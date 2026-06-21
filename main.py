import os
import telebot

# گرفتن توکن از Railway Variables
BOT_TOKEN = os.getenv("BOT_TOKEN")

# چک کردن توکن (برای جلوگیری از ارور)
if not BOT_TOKEN:
    raise Exception("BOT_TOKEN is not set in environment variables!")

bot = telebot.TeleBot(BOT_TOKEN)

# استارت ربات
@bot.message_handler(commands=['start'])
def start(message):
    bot.send_message(
        message.chat.id,
        "سلام 👋\nربات فعال شد."
    )

# یک تست ساده
@bot.message_handler(func=lambda m: True)
def echo(message):
    bot.send_message(message.chat.id, "پیام دریافت شد ✅")

print("Bot is running...")

bot.infinity_polling()
