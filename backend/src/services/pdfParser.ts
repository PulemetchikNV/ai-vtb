import pdf from 'pdf-parse'
import mammoth from 'mammoth'
import * as iconvLite from 'iconv-lite';
import { deEncapsulateSync } from 'rtf-stream-parser';


async function parseDocxBuffer(buf: Buffer): Promise<string> {
    const res = await mammoth.extractRawText({ buffer: buf })
    return (res as any)?.value || ''
}

function decodeRtfUnicodeEscapes(input: string): string {
    // \\uN fallback → unicode char (handle negative values)
    return input.replace(/\\u(-?\d+)[^a-zA-Z0-9]?/g, (_m, numStr) => {
        let code = parseInt(numStr, 10)
        if (Number.isNaN(code)) return ''
        if (code < 0) code = 65536 + code
        try { return String.fromCharCode(code) } catch { return '' }
    })
}

function decodeRtfHexEscapes(input: string): string {
    // \\'hh (treat as cp1251 to better support ru; falls back to utf8)
    return input.replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex) => {
        const b = Buffer.from(hex, 'hex')
        try {
            return iconvLite.decode(b, 'win1251')
        } catch {
            return b.toString('utf8')
        }
    })
}

function stripRtfControls(input: string): string {
    let s = input
        .replace(/\\par[d]?/g, '\n')
        .replace(/\\tab/g, '\t')
        .replace(/\\~/g, ' ')
    // Remove other control words like \\word123
    s = s.replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    // Remove groups braces
    s = s.replace(/[{}]/g, '')
    // Collapse whitespace
    s = s.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    return s.trim()
}

function stripRtfLargeGroups(input: string): string {
    // Удаляем большие служебные группы RTF: таблицы шрифтов/стилей/цветов, объекты, картинки и пр.
    let s = input
        // optional groups starting with *
        .replace(/\{\\\*[^{}]*\}/g, '')
        .replace(/\{\\\*[^]{0,100}?\}/g, '')
        // common bulky groups
        .replace(/\{\\fonttbl[\s\S]*?\}/g, '')
        .replace(/\{\\colortbl[\s\S]*?\}/g, '')
        .replace(/\{\\stylesheet[\s\S]*?\}/g, '')
        .replace(/\{\\info[\s\S]*?\}/g, '')
        .replace(/\{\\pict[\s\S]*?\}/g, '')
        .replace(/\{\\object[\s\S]*?\}/g, '')
        .replace(/\{\\*listtable[\s\S]*?\}/g, '')
        .replace(/\{\\*listoverridetable[\s\S]*?\}/g, '')
        .replace(/\{\\*latentstyles[\s\S]*?\}/g, '')
        .replace(/\{\\*rsidtbl[\s\S]*?\}/g, '')
        .replace(/\{\\*themedata[\s\S]*?\}/g, '')
        .replace(/\{\\*datastore[\s\S]*?\}/g, '')
    // Удаляем очень длинные base64/hex-подобные последовательности
    s = s.replace(/[A-Za-z0-9+/=]{200,}/g, '')
    return s
}

function postCleanup(input: string): string {
    let s = input
        // Удалить заголовки шрифтов/стилей, оставшиеся хвосты
        .replace(/(^|\n)[^\n]{0,30}(Cambria|Calibri|Consolas|Arial|Times New Roman|Thames|Endnote|Footnote|Header and Footer)\b[^\n]*\n/gi, '$1')
        // Удалить списки стилей вида "heading X; toc X; ..." в конце строки/блока
        .replace(/(^|\n)(heading\s+\d+;\s*)+(toc\s+\d+;\s*)+(Title;\s*)?(Subtitle;\s*)?(Hyperlink;\s*)?\s*$/gim, '$1')
        // Похожие хвосты без заголовка
        .replace(/(^|\n)(heading\s+\d+;\s*)+(Title;\s*)?(Subtitle;\s*)?(Hyperlink;\s*)?\s*$/gim, '$1')
        .replace(/(^|\n)(toc\s+\d+;\s*)+(Title;\s*)?(Subtitle;\s*)?(Hyperlink;\s*)?\s*$/gim, '$1')
        // Убрать двойные/висячие маркеры ;
        .replace(/;{2,}/g, ';')
        // Схлопнуть множественные пустые строки
        .replace(/\n{3,}/g, '\n\n')
    return s.trim()
}

function parseRtfPlain(buf: Buffer): string {
    const raw = buf.toString('utf8')
    const step0 = stripRtfLargeGroups(raw)
    const step1 = decodeRtfUnicodeEscapes(step0)
    const step2 = decodeRtfHexEscapes(step1)
    const step3 = stripRtfControls(step2)
    const cleaned = postCleanup(step3)
    return cleaned
}

async function parseRtfBuffer(buf: Buffer): Promise<string> {
    // Try robust RTF de-encapsulation first
    try {
        const parseResult = deEncapsulateSync(buf, { decode: iconvLite.decode })
        if (parseResult && (parseResult as any).text) return (parseResult as any).text as string
    } catch (e) {
        console.log('LIB RTF DECODING ERROR', e)
    }
    // Fallback to plain RTF decoding
    console.log('FALLBACK TO PLAIN RTF DECODING')
    return parseRtfPlain(buf)
}

export const pdfParser = {
    async parseFromBase64(pdfBase64: string): Promise<string> {
        const buf = Buffer.from(pdfBase64, 'base64')
        const data = await pdf(buf)
        console.log('PARSING PDF RESULT', data)
        return (data as any)?.text || ''
    },
    async parseFromBuffer(buf: Buffer): Promise<string> {
        const data = await pdf(buf)
        return (data as any)?.text || ''
    }
}

export const docParser = {
    async parseFromBuffer(buf: Buffer, mime: string): Promise<string> {
        const head5 = buf.slice(0, 5).toString('utf8')
        const head4 = buf.slice(0, 4).toString('utf8')
        const head2 = buf.slice(0, 2).toString('utf8')
        const head8 = buf.slice(0, 8)
        console.log({ mime, head5, head4, head2 })

        // сигнатуры важнее mime
        if (head5.startsWith('{\\rtf')) return parseRtfBuffer(buf)
        if (head4 === '%PDF') return pdfParser.parseFromBuffer(buf)
        if (head2 === 'PK') return parseDocxBuffer(buf)
        // Old .doc (CFBF) magic: D0 CF 11 E0 A1 B1 1A E1
        const isCfbf = head8.length === 8 && head8[0] === 0xD0 && head8[1] === 0xCF && head8[2] === 0x11 && head8[3] === 0xE0
            && head8[4] === 0xA1 && head8[5] === 0xB1 && head8[6] === 0x1A && head8[7] === 0xE1
        if (isCfbf) {
            throw new Error('Unsupported legacy .doc format. Please convert to PDF/DOCX/RTF')
        }

        // по mime, если верный
        if (mime === 'application/pdf') return pdfParser.parseFromBuffer(buf)
        if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return parseDocxBuffer(buf)
        if (mime === 'application/rtf' || mime === 'text/rtf' || mime === 'application/msword') return parseRtfBuffer(buf)

        // последний шанс — как текст
        return buf.toString('utf8')
    }
}
export default pdfParser


