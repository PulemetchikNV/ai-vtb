FROM python:3.11-slim

WORKDIR /app

# Копируем файл зависимостей
COPY requirements.txt .

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код приложения
COPY message_bot.py .

# Открываем порт для API
EXPOSE 8000

# Запускаем бота
CMD ["python", "message_bot.py"]
