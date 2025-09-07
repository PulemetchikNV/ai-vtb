import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import multipart from '@fastify/multipart';
import type { IncomingMessage } from 'http';
import chatRoutes from './routes/chat';
import vacancyRoutes from './routes/vacancies';
import resumeRoutes from './routes/resumes';
import { EmotionsParserTranscriber, StubTranscriber } from './services/transcriber';
import { StreamingAudioSession } from './services/streamingSession';
import { chatDebugLog } from './services/chatDebug';
import { chatEventBus } from './services/chatEventBus';

export const server = Fastify({
    logger: {
        transport: {
            options: { colorize: true },
            targets: [
                {
                    // Терминал (красиво)
                    target: 'pino-pretty',
                    level: 'info',
                    options: {
                        colorize: true,
                        translateTime: 'SYS:standard',
                        ignore: 'pid,hostname'
                    }
                },
                // {
                //     // Файл с уровня 'info' и выше
                //     target: 'pino/file',
                //     level: 'info',
                //     options: {
                //         destination: './logs/app-info.log',
                //         // при необходимости укажите абсолютный путь
                //     }
                // }
            ]
        }
    }
});

export const logger = server.log;

async function start() {
    await server.register(cors, { origin: true });
    await server.register(multipart);

    server.get('/health', async () => {
        return { status: 'ok' };
    });

    await server.register(async (s) => {
        await chatRoutes(s);
    });
    await server.register(async (s) => {
        await vacancyRoutes(s);
    });
    await server.register(async (s) => {
        await resumeRoutes(s);
    });

    // WebSocket server for streaming audio chunks
    // Use noServer and a single upgrade handler to multiplex by path safely
    const wss = new WebSocketServer({ noServer: true }); // /ws/audio
    const wssChat = new WebSocketServer({ noServer: true }); // /ws/chat

    wssChat.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        const chatId = url.searchParams.get('chatId') || '';
        if (!chatId) {
            ws.close(1008, 'chatId required');
            return;
        }
        chatEventBus.register(chatId, ws);
    });

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        const chatId = url.searchParams.get('chatId') || '';
        if (!chatId) {
            logger.warn({ event: 'ws-missing-chatId' }, 'Missing chatId in query');
            ws.close(1008, 'chatId required');
            return;
        }

        const emotionsUrl = process.env.EMOTIONS_URL || `http://emotions${process.env.NODE_ENV === 'development' ? '-dev' : ''}:5000`;
        const transcriber = emotionsUrl ? new EmotionsParserTranscriber(emotionsUrl) : new StubTranscriber();
        const session = new StreamingAudioSession({ logger: server.log, transcriber, chatId });
        let chunkCount = 0;
        logger.info({ event: 'ws-connected', url: req.url, chatId });

        ws.on('message', async (data: RawData) => {
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
            chunkCount += 1;
            session.handleChunk(buf);
            await chatDebugLog(chatId, `получен аудио-чанк #${chunkCount}, bytes=${buf.length}`)
        });

        ws.on('close', async () => {
            await session.end();
            logger.info({ event: 'ws-closed', chatId, chunksReceived: chunkCount });
        });
    });

    // Single upgrade handler dispatches to the proper WS server by pathname
    server.server.on('upgrade', (request, socket, head) => {
        try {
            const url = new URL(request.url ?? '', 'http://localhost');
            const pathname = url.pathname;
            if (pathname === '/ws/audio') {
                wss.handleUpgrade(request, socket, head, (ws) => {
                    wss.emit('connection', ws, request);
                });
            } else if (pathname === '/ws/chat') {
                wssChat.handleUpgrade(request, socket, head, (ws) => {
                    wssChat.emit('connection', ws, request);
                });
            } else {
                socket.destroy();
            }
        } catch (err) {
            socket.destroy();
        }
    });

    const port = Number(process.env.PORT) || 3000;
    const host = '0.0.0.0';

    try {
        await server.listen({ port, host });
        logger.info(`Server listening on ${host}:${port}`);
    } catch (error) {
        logger.error(error);
        process.exit(1);
    }
}

start();
