## Transcriber (FastAPI + Whisper ONNX)

Сервис транскрибации аудио на базе `bond005/whisper-podlodka-turbo` c конвертацией в ONNX (Optimum ORT). Предоставляет веб-страницу (`/`) и API `POST /transcribe/`.

## Настройка проекта

1.  **Клонируйте репозиторий:**
    ```bash
    git clone https://github.com/MINTIC-CO/backend_to_site_trans.git
    cd backend_to_site_trans
    ```

2.  **Создайте виртуальное окружение Python:**
    ```bash
    python -m venv venv
    ```

3.  **Активируйте виртуальное окружение:**
    *   В Windows:
        ```bash
        venv\Scripts\activate
        ```
    *   В macOS/Linux:
        ```bash
        source venv/bin/activate
        ```

4.  **Установите необходимые зависимости:**
    ```bash
    pip install -r requirements.txt
    ```

5.  **Загрузка модели:**
    При первом запуске приложения модель будет автоматически загружена из Hugging Face Hub. Никаких дополнительных действий не требуется.

## Запуск сервера

После завершения настройки вы можете запустить сервер API с помощью следующей команды:

```bash
uvicorn main:app --host 0.0.0.0 --port 5544
```

Сервер будет запущен по адресу `http://localhost:5544`.

## Конечная точка API

### `/transcribe/`

Эта конечная точка транскрибирует аудиофайл и возвращает текст транскрипции.

*   **Метод:** `POST`
*   **Тело запроса:** `multipart/form-data`
*   **Параметр:**
    *   `file`: Аудиофайл для транскрибации. Файл должен иметь тип контента, начинающийся с `audio/` (например, `audio/wav`, `audio/mpeg`).

#### Пример запроса

Вы можете использовать инструмент, такой как `curl`, для отправки запроса:

```bash
curl -s -X POST -F "file=@/path/to/your/audio.wav" http://localhost:5544/transcribe/ | jq .
```

### Docker
```bash
docker build -f transcriber/Dockerfile -t transcriber:latest transcriber
docker run --rm -p 5544:5544 transcriber:latest
```

### Compose
- Сервис будет добавлен в `docker-compose.yml` как `transcriber` (5544)
- В `docker-compose.dev.yml` как `transcriber-dev` (с монтированием кода)

#### Пример ответа

API вернет объект JSON, содержащий транскрипцию.

*   **Успешный ответ (200 OK):**
    ```json
    {
      "transcription": "Это пример распознанного текста."
    }
    ```

*   **Ответ об ошибке (400 Bad Request):**
    Если загруженный файл не является аудиофайлом.
    ```json
    {
      "detail": "Invalid file type. Please upload an audio file."
    }
    ```

*   **Ответ об ошибке (500 Internal Server Error):**
    Если во время процесса транскрибации возникает ошибка.
    ```json
    {
      "detail": "An error occurred during transcription: [error message]"
    }
