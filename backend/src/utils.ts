export function extractJsonWithoutRegex(text: string) {
    const startMarker = '```json';
    const endMarker = '```';

    const startIndex = text.indexOf(startMarker);
    // Если начальный маркер не найден, выходим
    if (startIndex === -1) {
        let isJson = false;
        try {
            JSON.parse(text);
            isJson = true;
        } catch (e) {
            isJson = false;
        }
        if (isJson) {
            return text;
        }
        return null;
    }

    // Ищем конечный маркер ПОСЛЕ начального
    const endIndex = text.lastIndexOf(endMarker);

    // Убедимся, что конечный маркер находится после начального
    if (endIndex === -1 || endIndex <= startIndex) {
        return null;
    }

    // Вырезаем строку между маркерами
    const jsonString = text.substring(startIndex + startMarker.length, endIndex);

    return jsonString.trim();
}
