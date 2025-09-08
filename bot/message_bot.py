import asyncio
import logging
import os
import threading
from typing import Dict, Optional, Set
import aiohttp
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("BOT_TOKEN")
BACKEND_API_URL = os.getenv("BACKEND_API_URL")

if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN environment variable is required")
if not BACKEND_API_URL:
    raise ValueError("BACKEND_API_URL environment variable is required")


class NotificationRequest(BaseModel):
    text: str
    userId: str


class TelegramBot:
    def __init__(self, token: str):
        self.token = token
        self.application: Optional[Application] = None
        self.user_states: Dict[int, str] = {}
        self.running = False

    async def initialize(self):
        self.application = Application.builder().token(self.token).build()
        self.application.add_handler(CommandHandler("start", self._start))
        self.application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self._handle_text))

        await self.application.initialize()
        await self.application.start()
        self.running = True
        await self.application.updater.start_polling()

        while self.running:
            await asyncio.sleep(1)

    async def _start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        user_id = update.effective_user.id
        self.user_states[user_id] = "waiting_code"
        await update.message.reply_text("Введите код из профиля:")

    async def _handle_text(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        user_id = update.effective_user.id
        code = update.message.text.strip()

        if self.user_states.get(user_id) == "waiting_code":
            await self._process_code(update, code)
        else:
            await update.message.reply_text("Введите /start")

    async def _process_code(self, update: Update, code: str):
        user_id = update.effective_user.id

        try:
            url = f"{BACKEND_API_URL}/connect-tg"
            params = {"code": code, "telegramId": str(user_id)}

            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        self.user_states[user_id] = "connected"
                        await update.message.reply_text("✅ Подключение успешно!")
                    else:
                        await update.message.reply_text("❌ Неверный код")
        except:
            await update.message.reply_text("❌ Ошибка подключения")

    async def send_notification(self, user_id: int, text: str) -> bool:
        try:
            await self.application.bot.send_message(chat_id=user_id, text=text)
            return True
        except:
            return False

    async def stop(self):
        self.running = False
        if self.application:
            await self.application.stop()
            await self.application.shutdown()


class NotificationAPI:
    def __init__(self, bot: TelegramBot):
        self.bot = bot
        self.app = FastAPI()
        self._setup_routes()

    def _setup_routes(self):
        @self.app.post("/notification")
        async def send_notification(request: NotificationRequest):
            try:
                user_id = int(request.userId)
                success = await self.bot.send_notification(user_id, request.text)
                if success:
                    return {"success": True}
                raise HTTPException(status_code=500, detail="Send failed")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid userId")

    def run(self):
        uvicorn.run(self.app, host="0.0.0.0", port=8000, log_level="error")


class VTBSystem:
    def __init__(self):
        self.bot = TelegramBot(BOT_TOKEN)
        self.api = NotificationAPI(self.bot)

    async def start(self):
        api_thread = threading.Thread(target=self.api.run, daemon=True)
        api_thread.start()
        await asyncio.sleep(2)
        await self.bot.initialize()


async def main():
    system = VTBSystem()
    await system.start()


if __name__ == "__main__":
    asyncio.run(main())