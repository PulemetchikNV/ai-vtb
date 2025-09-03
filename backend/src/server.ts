import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import type { IncomingMessage } from 'http';

const server = Fastify({
    logger: {
        transport: {
            target: 'pino-pretty',
            options: { colorize: true }
        }
    }
});

async function start() {
    await server.register(cors, { origin: true });

    server.get('/health', async () => {
        return { status: 'ok' };
    });

    // WebSocket server for streaming audio chunks
    const wss = new WebSocketServer({ server: server.server, path: '/ws/audio' });
    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        let chunkCount = 0;
        server.log.info({ event: 'ws-connected', url: req.url });

        ws.on('message', (data: RawData) => {
            const size = Buffer.isBuffer(data)
                ? data.length
                : typeof data === 'string'
                    ? Buffer.byteLength(data)
                    : ArrayBuffer.isView(data)
                        ? data.byteLength
                        : (data as ArrayBuffer).byteLength || 0;
            chunkCount += 1;
            server.log.info({ event: 'audio-chunk', chunkCount, size });
        });

        ws.on('close', () => {
            server.log.info({ event: 'ws-closed', chunksReceived: chunkCount });
        });
    });

    const port = Number(process.env.PORT) || 3000;
    const host = '0.0.0.0';

    try {
        await server.listen({ port, host });
        server.log.info(`Server listening on ${host}:${port}`);
    } catch (error) {
        server.log.error(error);
        process.exit(1);
    }
}

start();
