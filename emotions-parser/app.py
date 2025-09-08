import os
import re
from flask import Flask, render_template, request, redirect, url_for, jsonify
from werkzeug.utils import secure_filename
from sentiment_analyzer import analyze_sentiment

# --- Настройка Flask ---
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB

# Создаем папку для загрузок, если ее нет
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# --- Роуты ---

@app.route('/')
def index():
    """Отображает главную страницу с формой загрузки."""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Обрабатывает загрузку файла и запускает анализ."""
    if 'file' not in request.files:
        return redirect(request.url)
    
    file = request.files['file']
    if file.filename == '':
        return redirect(request.url)

    if file and file.filename.lower().endswith('.wav'):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # Запускаем анализ
        analysis_result = analyze_sentiment(filepath)

        # Удаляем временный файл после анализа
        os.remove(filepath)

        return render_template('result.html', result=analysis_result)
    else:
        return "Ошибка: Пожалуйста, загрузите файл в формате .wav", 400

@app.route('/api/analyze', methods=['POST'])
def api_analyze():
    """Принимает .wav файл и возвращает JSON с распознанным текстом,
    анализом тональности и пауз."""
    if 'file' not in request.files:
        return jsonify({"error": "file field is required (multipart/form-data)"}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({"error": "no file provided"}), 400

    if not file.filename.lower().endswith('.wav'):
        return jsonify({"error": "please upload a .wav file"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    # Получаем язык из формы, по умолчанию 'ru'
    lang = request.form.get('lang', 'ru')

    try:
        analysis_result = analyze_sentiment(filepath, lang=lang)
    finally:
        # Удаляем временный файл после анализа
        try:
            os.remove(filepath)
        except Exception:
            pass

    if isinstance(analysis_result, dict) and analysis_result.get('error'):
        return jsonify({"error": analysis_result['error']}), 400

    recognized_text = analysis_result.get('recognized_text', '')
    sentiment = analysis_result.get('sentiment_analysis', {})
    pause = analysis_result.get('pause_analysis', {})

    label = sentiment.get('label')
    score = sentiment.get('score')
    emotion_raw = sentiment.get('emotion')  # формат: 1 ("sad")

    emotion_code = None
    emotion_label = None
    if isinstance(emotion_raw, str):
        m = re.match(r"^(\\d+) \\\"?\\(\"?([^\"]+)\"?\\)\\\"?$", emotion_raw)  # защитный парсер
        if not m:
            m = re.match(r"^(\\d+) \\((?:\"|\')?([^\"\']+)(?:\"|\')?\\)$", emotion_raw)
        if m:
            try:
                emotion_code = int(m.group(1))
            except ValueError:
                emotion_code = None
            emotion_label = m.group(2)

    total_ms = pause.get('total_pause_duration_ms') or 0
    total_seconds = round((total_ms or 0) / 1000.0, 2)

    response = {
        "recognized_text": recognized_text,
        "sentiment_model": label,
        "sentiment_confidence": round(float(score), 2) if isinstance(score, (int, float)) else score,
        "final_emotion": {
            "code": emotion_code,
            "label": emotion_label,
            "raw": emotion_raw,
        },
        "pause_count": pause.get('pause_count'),
        "total_pause_duration_seconds": total_seconds,
        "pauses_ms": pause.get('pauses_ms', []),
    }

    return jsonify(response)

# --- Запуск приложения ---

if __name__ == '__main__':
    # Важно: debug=True не использовать в продакшене!
    app.run(debug=True, host='0.0.0.0', port=5000)
