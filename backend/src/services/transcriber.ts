export interface Transcriber {
    transcribeAudioWebmOpus(audioBuffer: Buffer): Promise<string>;
}

export class StubTranscriber implements Transcriber {
    async transcribeAudioWebmOpus(audioBuffer: Buffer): Promise<string> {
        const approxSeconds = Math.max(1, Math.round(audioBuffer.length / (16_000 * 2))); // rough placeholder
        return `Голосовое сообщение (~${approxSeconds}s, ${audioBuffer.length} байт)`;
    }
}
