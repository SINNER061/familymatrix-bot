import telebot
from telebot import types
import json
import os
import time

# 🔑 اطلاعات جایگذاری‌شده شما
TOKEN = "8893463768:AAER6NgnJIB8wCBbbcZWv8dEZ4XJhbMs5hA"
OWNER_ID = 8893463768

bot = telebot.TeleBot(TOKEN)

DB_FILE = "bot_data.json"

def load_data():
    if not os.path.exists(DB_FILE):
        return {
            "users": {},
            "admins": [OWNER_ID],
            "pending_requests": {}
        }
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {
            "users": {},
            "admins": [OWNER_ID],
            "pending_requests": {}
        }

def save_data(data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

data = load_data()

RANKS = [
    ("NEW ⚔ MEMBERS", 0),
    ("MEMBERS ⚔ BRONZE", 50),
    ("BRONZE ⚔ SILVER", 75),
    ("SILVER ⚔ GOLD", 100),
    ("GOLD ⚔ DIAMOND", 125),
    ("DIAMOND ⚔ SENTRY", 150),
    ("SENTRY ⚔ SOLDIER", 180),
    ("SOLDIER ⚔ GRENADIER", 210),
    ("GRENADIER ⚔ SERGEANT", 250),
    ("SERGEANT ⚔ COLONEL", 290),
    ("COLONEL ⚔ LIEUTENANT", 330),
    ("LIEUTENANT ⚔ RANGER", 380),
    ("RANGER ⚔ FUSILIER", 430),
    ("FUSILIER ⚔ GUNNER", 490),
    ("GUNNER ⚔ MARINE", 560),
    ("MARINE ⚔ MAJOR", 640),
    ("MAJOR ⚔ BRIGADIER", 730)
]

def get_main_keyboard(user_id):
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    btn_ranks = types.KeyboardButton("📜 رنک‌های فمیلی")
    btn_req_points = types.KeyboardButton("📥 درخواست امتیاز")
    btn_change_rank = types.KeyboardButton("⬆️ تغییر رنک در ربات")
    btn_leaderboard = types.KeyboardButton("🏆 لیدربورد")
    btn_about = types.KeyboardButton("ℹ️ درباره ربات (About)")
    
    markup.add(btn_ranks, btn_req_points, btn_change_rank, btn_leaderboard, btn_about)
    
    if user_id == OWNER_ID:
        markup.add(types.KeyboardButton("⚙️ پنل ادمین"))
        
    return markup

@bot.message_handler(commands=['start'])
def send_welcome(message):
    user_id = str(message.from_user.id)
    
    if user_id not in data["users"]:
        data["users"][user_id] = {
            "name": message.from_user.first_name or "کاربر",
            "username": message.from_user.username or "ندارد",
            "points": 0,
            "rank": "NEW ⚔ MEMBERS",
            "is_banned": False
        }
        save_data(data)

    if data["users"][user_id].get("is_banned", False):
        bot.send_message(message.chat.id, "❌ شما از استفاده از این ربات مسدود شده‌اید.")
        return

    bot.send_message(
        message.chat.id, 
        f"سلام {message.from_user.first_name} عزیز! به ربات فمیلی ماتریکس خوش آمدید.\nلطفاً از منوی زیر استفاده کنید:",
        reply_markup=get_main_keyboard(message.from_user.id)
    )

@bot.message_handler(func=lambda m: m.text == "📜 رنک‌های فمیلی")
def show_ranks(message):
    text = """FAMILY MATRIX II
RANKS & REQUIRED POINTS

RANK | REQUIRED POINTS
NEW ⚔ MEMBERS — (TAG FAMILY)
MEMBERS ⚔ BRONZE — 50 P
BRONZE ⚔ SILVER — 75 P
SILVER ⚔ GOLD — 100 P
GOLD ⚔ DIAMOND — 125 P
DIAMOND ⚔ SENTRY — 150 P
SENTRY ⚔ SOLDIER — 180 P
SOLDIER ⚔ GRENADIER — 210 P
GRENADIER ⚔ SERGEANT — 250 P
SERGEANT ⚔ COLONEL — 290 P
COLONEL ⚔ LIEUTENANT — 330 P
LIEUTENANT ⚔ RANGER — 380 P
RANGER ⚔ FUSILIER — 430 P
FUSILIER ⚔ GUNNER — 490 P
GUNNER ⚔ MARINE — 560 P
MARINE ⚔ MAJOR — 640 P
MAJOR ⚔ BRIGADIER — 730 P
BRIGADIER ⚔ STAFF — NEED REQUEST & LEADER APPROVAL

📌 NOTES:
• تمامی قوانین درخواست رنک باید رعایت شه در غیر این صورت شما 1 هفته از Rank Up عقب میوفتید!
• بعد از تایید شدن درخواست امتیاز باید صبر کنید تا امتیازتون تو لیست ثبت بشه بعد درخواست رنک رو بدید!
• هیچ محدودیتی در Rank Up وجود ندارد و با امتیازتون میتونید به هر Rank هر سیزن برسید!"""
    bot.send_message(message.chat.id, text)

@bot.message_handler(func=lambda m: m.text == "📥 درخواست امتیاز")
def request_points_info(message):
    text = """MATRIX FAMILY
ACTIVITY POINTS

ACTIVITY | POINTS & REWARD
• TOP LEADER IN SEASON — 300 P + 2 RANKS
• TOP SUB IN SEASON — 180 P + 2 RANKS
• SUB FROM FACTION — 120 P + 1 RANK
• MANAGER FROM FACTION — 100 P + 1 RANK
• TOP WEEK MEMBER IN FACTION — 80 P + 1 RANK
• PAYAN HAMKARI FACTION — 50 P
• SHERKAT DAR MEETING FAMILY — 50 P
• WINNER IN EVENT FAMILY — 40 P
• TABLIGH FAMILY DAR SATH SHAHR (ESTEFADE AZ TABLOHA) — 30 P
• DADAN GUN BE STAFF (HAR 1K) — 30 P

📌 NOTES:
1. برای درخواست امتیاز باید عکس مدرک فعالیت خود را همین الان ارسال کنید.
2. در هر فصل حق درخواست امتیاز تا حداکثر 1000P را دارید!
3. حتماً و حتماً باید یک رکورد یا عکس از فعالیت ارسال‌شده خودتان داشته باشید.

لطفاً عکس مدرک فعالیت خود را ارسال کنید:"""
    msg = bot.send_message(message.chat.id, text)
    bot.register_next_step_handler(msg, process_photo_submission)

def process_photo_submission(message):
    if not message.photo:
        bot.send_message(message.chat.id, "❌ خطا! عکسی ارسال نشد. فرآیند لغو گردید.")
        return
    
    photo_id = message.photo[-1].file_id
    msg = bot.send_message(message.chat.id, "توضیحات و مقدار امتیاز درخواستی خود را بنویسید:")
    bot.register_next_step_handler(msg, process_details_submission, photo_id)

def process_details_submission(message, photo_id):
    user_id = str(message.from_user.id)
    req_id = str(int(time.time()))
    
    data["pending_requests"][req_id] = {
        "user_id": user_id,
        "details": message.text,
        "photo_id": photo_id
    }
    save_data(data)
    
    markup = types.InlineKeyboardMarkup()
    markup.add(
        types.InlineKeyboardButton("✅ تأیید", callback_data=f"approve_{req_id}"),
        types.InlineKeyboardButton("❌ رد", callback_data=f"reject_{req_id}")
    )
    
    for admin_id in data["admins"]:
        try:
            bot.send_photo(
                admin_id, 
                photo_id, 
                caption=f"📥 **درخواست امتیاز جدید**\nاز طرف: {message.from_user.first_name} (@{message.from_user.username})\nتوضیحات: {message.text}",
                reply_markup=markup,
                parse_mode="Markdown"
            )
        except:
            pass
            
    bot.send_message(message.chat.id, "✅ درخواست شما برای ادمین‌ها ارسال شد.")

@bot.callback_query_handler(func=lambda call: call.data.startswith(('approve_', 'reject_')))
def handle_approval(call):
    admin_id = call.from_user.id
    action, req_id = call.data.split('_')
    
    if str(admin_id) not in [str(a) for a in data["admins"]]:
        bot.answer_callback_query(call.id, "شما ادمین نیستید!", show_alert=True)
        return

    req = data["pending_requests"].get(req_id)
    if not req:
        bot.answer_callback_query(call.id, "این درخواست قبلاً بررسی شده یا وجود ندارد.", show_alert=True)
        return

    target_user_id = req["user_id"]
    
    if action == "approve":
        msg = bot.send_message(call.message.chat.id, "چند امتیاز به کاربر اضافه شود؟ (عدد وارد کنید):")
        bot.register_next_step_handler(msg, finalize_approval, req_id, target_user_id)
    else:
        msg = bot.send_message(call.message.chat.id, "دلیل رد شدن درخواست کاربر را بنویسید:")
        bot.register_next_step_handler(msg, finalize_rejection, req_id, target_user_id)

def finalize_approval(message, req_id, target_user_id):
    try:
        points_to_add = int(message.text)
        if target_user_id in data["users"]:
            data["users"][target_user_id]["points"] += points_to_add
            
        bot.send_message(target_user_id, f"🎉 درخواست امتیاز شما تأیید شد!\nمقدار {points_to_add} امتیاز به حساب شما اضافه شد.")
        
        bot.send_message(
            OWNER_ID, 
            f"📜 **لاگ ادمین:**\nادمین {message.from_user.first_name} درخواست کاربر {target_user_id} را تأیید کرد و {points_to_add} امتیاز اضافه شد."
        )
        
        bot.send_message(message.chat.id, "✅ با موفقیت ثبت شد.")
        if req_id in data["pending_requests"]:
            del data["pending_requests"][req_id]
        save_data(data)
    except ValueError:
        bot.send_message(message.chat.id, "❌ عدد وارد شده نامعتبر است.")

def finalize_rejection(message, req_id, target_user_id):
    reason = message.text
    bot.send_message(target_user_id, f"❌ درخواست امتیاز شما رد شد.\nعلت رد: {reason}")
    
    bot.send_message(
        OWNER_ID, 
        f"📜 **لاگ ادمین:**\nادمین {message.from_user.first_name} درخواست کاربر {target_user_id} را رد کرد.\nعلت: {reason}"
    )
    
    bot.send_message(message.chat.id, "❌ درخواست رد شد.")
    if req_id in data["pending_requests"]:
        del data["pending_requests"][req_id]
    save_data(data)

@bot.message_handler(func=lambda m: m.text == "⬆️ تغییر رنک در ربات")
def change_rank(message):
    user_id = str(message.from_user.id)
    user = data["users"].get(user_id)
    
    if not user:
        return
        
    user_points = user["points"]
    text = f"موجودی امتیاز شما: **{user_points}**\nرنک فعلی: **{user['rank']}**\n\nانتخاب کنید به کدام رنک می‌خواهید ارتقا یابید:"
    
    markup = types.InlineKeyboardMarkup()
    for rank_name, req_points in RANKS:
        if req_points > 0:
            markup.add(types.InlineKeyboardButton(f"{rank_name} ({req_points} P)", callback_data=f"setrank_{rank_name}_{req_points}"))
            
    bot.send_message(message.chat.id, text, reply_markup=markup, parse_mode="Markdown")

@bot.callback_query_handler(func=lambda call: call.data.startswith('setrank_'))
def process_rank_change(call):
    _, rank_name, req_points = call.data.split('_')
    req_points = int(req_points)
    user_id = str(call.from_user.id)
    user = data["users"].get(user_id)
    
    if user["points"] >= req_points:
        user["points"] -= req_points
        user["rank"] = rank_name
        save_data(data)
        bot.answer_callback_query(call.id, f"رنک شما به {rank_name} ارتقا یافت.", show_alert=True)
        bot.send_message(call.message.chat.id, f"🎉 رنک جدید شما: **{rank_name}** ست شد.")
    else:
        bot.answer_callback_query(call.id, "شما امتیاز کافی برای این رنک ندارید!", show_alert=True)

@bot.message_handler(func=lambda m: m.text == "🏆 لیدربورد")
def show_leaderboard(message):
    sorted_users = sorted(data["users"].items(), key=lambda x: x[1]["points"], reverse=True)
    
    text = "🏆 **جدول برترین‌های لیدربورد:**\n\n"
    rank_index = 1
    for u_id, u_info in sorted_users:
        text += f"{rank_index}. {u_info['name']} | رنک: {u_info['rank']} | امتیاز: {u_info['points']}\n"
        rank_index += 1
        if rank_index > 20:
            break
            
    bot.send_message(message.chat.id, text, parse_mode="Markdown")

@bot.message_handler(func=lambda m: m.text == "ℹ️ درباره ربات (About)")
def show_about(message):
    text = """ℹ️ **درباره ربات:**

هدف اصلی این ربات مدیریت امتیازات، لیدربورد و ارتقای رنک اعضای **فمیلی ماتریکس (MATRIX FAMILY)** بر اساس میزان فعالیت‌ها و مشارکت‌های آن‌ها در سطح شهر و فکشن‌ها می‌باشد.

📌 **راهنمای کارکرد:**
1. با ثبت عکس مدارک فعالیت‌های خود در بخش «درخواست امتیاز»، امتیاز دریافت کنید.
2. پس از بررسی ادمین‌ها و افزودن امتیاز، می‌توانید در بخش «تغییر رنک» رنک خود را ارتقا دهید.
3. با کسب بالاترین امتیاز در لیدربورد ۲۲ روزه فصل، از جایزه‌های ویژه برخوردار شوید.

---
این ربات توسط سپهر (ماتریکس) @oovqx نوشته شده است."""
    bot.send_message(message.chat.id, text, parse_mode="Markdown")

@bot.message_handler(func=lambda m: m.text == "⚙️ پنل ادمین" and m.from_user.id == OWNER_ID)
def admin_panel(message):
    markup = types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add(
        "➕ افزودن ادمین", "➖ حذف ادمین",
        "⚠️ صفر کردن همه امتیازها", "🔙 بازگشت به منوی اصلی"
    )
    bot.send_message(message.chat.id, "پنل مدیریت مالکین:", reply_markup=markup)

@bot.message_handler(func=lambda m: m.text == "🔙 بازگشت به منوی اصلی")
def back_to_main(message):
    bot.send_message(message.chat.id, "بازگشت به منوی اصلی", reply_markup=get_main_keyboard(message.from_user.id))

@bot.message_handler(func=lambda m: m.text == "➕ افزودن ادمین" and m.from_user.id == OWNER_ID)
def add_admin_step(message):
    msg = bot.send_message(message.chat.id, "آیدی عددی کاربر را بفرستید:")
    bot.register_next_step_handler(msg, process_add_admin)

def process_add_admin(message):
    try:
        new_admin = int(message.text)
        if new_admin not in data["admins"]:
            data["admins"].append(new_admin)
            save_data(data)
            bot.send_message(message.chat.id, "✅ ادمین جدید اضافه شد.")
        else:
            bot.send_message(message.chat.id, "این کاربر از قبل ادمین است.")
    except:
        bot.send_message(message.chat.id, "❌ آیدی عددی نامعتبر است.")

@bot.message_handler(func=lambda m: m.text == "➖ حذف ادمین" and m.from_user.id == OWNER_ID)
def remove_admin_step(message):
    msg = bot.send_message(message.chat.id, "آیدی عددی ادمین را بفرستید:")
    bot.register_next_step_handler(msg, process_remove_admin)

def process_remove_admin(message):
    try:
        admin_id = int(message.text)
        if admin_id in data["admins"] and admin_id != OWNER_ID:
            data["admins"].remove(admin_id)
            save_data(data)
            bot.send_message(message.chat.id, "✅ ادمین حذف شد.")
        else:
            bot.send_message(message.chat.id, "❌ پیدا نشد یا امکان حذف مالک وجود ندارد.")
    except:
        bot.send_message(message.chat.id, "❌ آیدی نامعتبر است.")

@bot.message_handler(func=lambda m: m.text == "⚠️ صفر کردن همه امتیازها" and m.from_user.id == OWNER_ID)
def reset_all_points(message):
    for u_id in data["users"]:
        data["users"][u_id]["points"] = 0
    save_data(data)
    bot.send_message(message.chat.id, "🔥 تمام امتیازها صفر شد.")

bot.infinity_polling()
  
