import librosa  # for loading sound from local file
from transformers import pipeline  # for working with Whisper-Podlodka-Turbo
import wget  # for downloading demo sound from its URL
from whisper_lid.whisper_lid import detect_language_in_speech  # for spoken language detection
import torch
from optimum.onnxruntime import ORTModelForSpeechSeq2Seq

# --- Model Loading ---
# Use the original model ID. Optimum will handle the download and conversion to ONNX.
model_id = "bond005/whisper-podlodka-turbo"
target_sampling_rate = 16_000  # Hz

print("Loading and converting model to ONNX...")
# The `export=True` flag tells Optimum to download the PyTorch model and convert it to ONNX.
# The converted model will be cached locally for future runs.
model = ORTModelForSpeechSeq2Seq.from_pretrained(model_id, export=True)
print("Model loaded and converted to ONNX.")

asr = pipeline(
    task="automatic-speech-recognition",
    model=model,
    tokenizer=model_id,
    feature_extractor=model_id,
    device_map='auto',
    torch_dtype='auto'
)

# An example of speech recognition in Russian, spoken by a native speaker of this language
sound_ru_url = 'https://huggingface.co/bond005/whisper-podlodka-turbo/resolve/main/test_sound_ru.wav'
sound_ru_name = wget.download(sound_ru_url)
sound_ru = librosa.load(sound_ru_name, sr=target_sampling_rate, mono=True)[0]
print('Duration of sound with Russian speech = {0:.3f} seconds.'.format(
    sound_ru.shape[0] / target_sampling_rate
))
detected_languages = detect_language_in_speech(
    sound_ru,
    asr.feature_extractor,
    asr.tokenizer,
    asr.model
)
print('Top-3 languages:')
lang_text_width = max([len(it[0]) for it in detected_languages])
for it in detected_languages[0:3]:
    print('  {0:>{1}} {2:.4f}'.format(it[0], lang_text_width, it[1]))
recognition_result = asr(
    sound_ru,
    generate_kwargs={'task': 'transcribe', 'language': detected_languages[0][0]},
    return_timestamps=False
)
print(recognition_result['text'] + '\n')

# An example of speech recognition in English, pronounced by a non-native speaker of that language with an accent
sound_en_url = 'https://huggingface.co/bond005/whisper-podlodka-turbo/resolve/main/test_sound_en.wav'
sound_en_name = wget.download(sound_en_url)
sound_en = librosa.load(sound_en_name, sr=target_sampling_rate, mono=True)[0]
print('Duration of sound with English speech = {0:.3f} seconds.'.format(
    sound_en.shape[0] / target_sampling_rate
))
detected_languages = detect_language_in_speech(
    sound_en,
    asr.feature_extractor,
    asr.tokenizer,
    asr.model
)
print('Top-3 languages:')
lang_text_width = max([len(it[0]) for it in detected_languages])
for it in detected_languages[0:3]:
    print('  {0:>{1}} {2:.4f}'.format(it[0], lang_text_width, it[1]))
recognition_result = asr(
    sound_en,
    generate_kwargs={'task': 'transcribe', 'language': detected_languages[0][0]},
    return_timestamps=False
)
print(recognition_result['text'] + '\n')

# Speech recognition with timestamps
recognition_result = asr(
    sound_ru,
    generate_kwargs={'task': 'transcribe', 'language': 'russian'},
    return_timestamps=True
)
print('Recognized chunks of Russian speech:')
for it in recognition_result['chunks']:
    print(f'  {it}')

recognition_result = asr(
    sound_en,
    generate_kwargs={'task': 'transcribe', 'language': 'english'},
    return_timestamps=True
)
print('\nRecognized chunks of English speech:')
for it in recognition_result['chunks']:
    print(f'  {it}')

# Voice activity detection (speech/non-speech)
nonspeech_sound_url = 'https://huggingface.co/bond005/whisper-podlodka-turbo/resolve/main/test_sound_nonspeech.wav'
nonspeech_sound_name = wget.download(nonspeech_sound_url)
nonspeech_sound = librosa.load(nonspeech_sound_name, sr=target_sampling_rate, mono=True)[0]
print('Duration of sound without speech = {0:.3f} seconds.'.format(
    nonspeech_sound.shape[0] / target_sampling_rate
))
detected_languages = detect_language_in_speech(
    nonspeech_sound,
    asr.feature_extractor,
    asr.tokenizer,
    asr.model
)
print('Top-3 languages:')
lang_text_width = max([len(it[0]) for it in detected_languages])
for it in detected_languages[0:3]:
    print('  {0:>{1}} {2:.4f}'.format(it[0], lang_text_width, it[1]))

# Speech translation
print(f'Speech translation from Russian to English:')
recognition_result = asr(
    sound_ru,
    generate_kwargs={'task': 'translate', 'language': 'english'},
    return_timestamps=False
)
print(recognition_result['text'] + '\n')

print(f'Speech translation from English to Russian:')
recognition_result = asr(
    sound_en,
    generate_kwargs={'task': 'translate', 'language': 'russian'},
    return_timestamps=False
)
print(recognition_result['text'] + '\n')
