import { FastifyInstance } from 'fastify'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../prisma'
import { documentsApi } from '../services/documentsApi'
import { requireAuth } from '../middleware/authMiddleware'
import { pdfParser, docParser } from '../services/pdfParser'
import { resumeConvertorChain } from '../chains/resumeConvertorChain'
import factExtractorChain from '../chains/factExtractorChain'

export default async function resumeRoutes(server: FastifyInstance) {
    // Создание: multipart (file=pdf) или JSON (text)
    server.post('/resumes', async (req: FastifyRequest, reply) => {
        try {
            const user = requireAuth(req as any);
            if (!user) return reply.code(401).send({ error: 'Unauthorized', message: 'Требуется авторизация' })

            let fileName = 'resume.pdf'
            let textRaw = ''

            const isMultipart = req.isMultipart && req.isMultipart()

            if (isMultipart) {
                const parts = (req as any).parts()
                for await (const part of parts) {
                    if (part.type === 'file' && part.file) {
                        fileName = part.filename || fileName

                        // Проверка размера файла
                        const chunks: Buffer[] = []
                        for await (const c of part.file) chunks.push(c)
                        const buf = Buffer.concat(chunks)

                        if (buf.length > 10 * 1024 * 1024) {
                            return reply.code(413).send({
                                error: 'File too large',
                                message: 'Размер файла превышает 10 МБ'
                            })
                        }

                        // Проверка типа файла
                        const allowedMimeTypes = [
                            'application/pdf',
                            'application/rtf',
                            'text/rtf',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                        ]

                        if (part.mimetype && !allowedMimeTypes.includes(part.mimetype)) {
                            return reply.code(415).send({
                                error: 'Unsupported file type',
                                message: 'Поддерживаются только файлы PDF, RTF и DOCX'
                            })
                        }

                        try {
                            textRaw = await docParser.parseFromBuffer(buf, part.mimetype)
                            if (!textRaw || textRaw.trim().length < 10) {
                                return reply.code(400).send({
                                    error: 'Document parsing failed',
                                    message: 'Не удалось извлечь текст из документа или файл содержит слишком мало текста'
                                })
                            }
                        } catch (e: any) {
                            return reply.code(400).send({
                                error: 'Document parsing failed',
                                message: 'Ошибка при обработке документа: ' + (e.message || 'неизвестная ошибка'),
                                detail: String(e)
                            })
                        }
                    } else if (part.type === 'field') {
                        if (part.fieldname === 'fileName' && typeof part.value === 'string') {
                            fileName = part.value.trim()
                        }
                        if (part.fieldname === 'text' && typeof part.value === 'string') {
                            textRaw = part.value.trim()
                        }
                    }
                }
            } else {
                const body = (req.body as any) || {}
                fileName = (body.fileName || fileName).trim()
                textRaw = (body.text || '').trim()
            }

            // Валидация данных
            if (!fileName) {
                return reply.code(400).send({
                    error: 'Validation failed',
                    message: 'Название файла обязательно'
                })
            }

            if (!textRaw) {
                return reply.code(400).send({
                    error: 'Validation failed',
                    message: 'Требуется загрузить файл или ввести текст резюме'
                })
            }

            if (textRaw.length < 10) {
                return reply.code(400).send({
                    error: 'Validation failed',
                    message: 'Текст резюме слишком короткий (минимум 10 символов)'
                })
            }

            if (textRaw.length > 100000) {
                return reply.code(400).send({
                    error: 'Validation failed',
                    message: 'Текст резюме слишком длинный (максимум 100,000 символов)'
                })
            }

            // Обработка AI цепочек
            let [facts, text] = await Promise.all([
                (async () => {
                    try {
                        return await factExtractorChain.invoke({ doc_type: 'резюме', context: textRaw, max_facts: 3 })
                    } catch (e) {
                        console.error('Fact extraction failed:', e)
                        return []
                    }
                })(),
                (async () => {
                    try {
                        return await resumeConvertorChain.invoke({ text: textRaw })
                    } catch (e) {
                        console.error('Resume conversion failed:', e)
                        return textRaw // Fallback к оригинальному тексту
                    }
                })()
            ])

            if (!Array.isArray(facts)) facts = []
            if (typeof text !== 'string') text = textRaw

            const resume = await (prisma as any).resume.create({
                data: {
                    fileName,
                    text_raw: textRaw,
                    text,
                    facts,
                    userId: user.id
                }
            })

            // Добавление в документы (необязательно)
            try {
                await documentsApi.addDocument({
                    source_id: resume.id,
                    source_type: 'resume',
                    document_name: fileName,
                    content: text,
                })
            } catch (e) {
                console.error('Failed to add to documents API:', e)
            }

            return reply.code(201).send(resume)

        } catch (error: any) {
            console.error('Resume creation error:', error)

            // Обработка ошибок Prisma
            if (error.code === 'P2002') {
                return reply.code(409).send({
                    error: 'Duplicate entry',
                    message: 'Резюме с таким названием уже существует'
                })
            }

            return reply.code(500).send({
                error: 'Internal server error',
                message: 'Произошла ошибка при создании резюме. Попробуйте еще раз.'
            })
        }
    })

    // Листинг
    server.get('/resumes', async (req: FastifyRequest) => {
        const user = requireAuth(req as any); if (!user) return []
        const items = await (prisma as any).resume.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
        return items
    })

    // Обновление: multipart или JSON
    server.put('/resumes/:id', async (req: FastifyRequest, reply) => {
        try {
            const user = requireAuth(req as any);
            if (!user) return reply.code(401).send({ error: 'Unauthorized', message: 'Требуется авторизация' })

            const { id } = req.params as { id: string }

            if (!id) {
                return reply.code(400).send({ error: 'Validation failed', message: 'ID резюме обязателен' })
            }

            let fileName: string | undefined
            let text: string | undefined

            const isMultipart = (req as any).isMultipart && (req as any).isMultipart()
            if (isMultipart) {
                const parts = (req as any).parts()
                for await (const part of parts) {
                    if (part.type === 'file' && part.file) {
                        fileName = part.filename || fileName
                        const chunks: Buffer[] = []
                        for await (const c of part.file) chunks.push(c)
                        const buf = Buffer.concat(chunks)

                        if (buf.length > 10 * 1024 * 1024) {
                            return reply.code(413).send({
                                error: 'File too large',
                                message: 'Размер файла превышает 10 МБ'
                            })
                        }

                        const allowedMimeTypes = [
                            'application/pdf',
                            'application/rtf',
                            'text/rtf',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                        ]

                        if (part.mimetype && !allowedMimeTypes.includes(part.mimetype)) {
                            return reply.code(415).send({
                                error: 'Unsupported file type',
                                message: 'Поддерживаются только файлы PDF, RTF и DOCX'
                            })
                        }

                        try {
                            text = await docParser.parseFromBuffer(buf, part.mimetype)
                            if (!text || text.trim().length < 10) {
                                return reply.code(400).send({
                                    error: 'Document parsing failed',
                                    message: 'Не удалось извлечь текст из документа или файл содержит слишком мало текста'
                                })
                            }
                        } catch (e: any) {
                            return reply.code(400).send({
                                error: 'Document parsing failed',
                                message: 'Ошибка при обработке документа: ' + (e.message || 'неизвестная ошибка')
                            })
                        }
                    } else if (part.type === 'field') {
                        if (part.fieldname === 'fileName' && typeof part.value === 'string') {
                            fileName = part.value.trim()
                        }
                        if (part.fieldname === 'text' && typeof part.value === 'string') {
                            text = part.value.trim()
                        }
                    }
                }
            } else {
                const body = (req.body as any) || {}
                fileName = body.fileName ? body.fileName.trim() : undefined
                text = body.text ? body.text.trim() : undefined
                const pdfBase64 = body.pdfBase64 as string | undefined

                if (!text && pdfBase64) {
                    try {
                        text = await pdfParser.parseFromBase64(pdfBase64)
                        if (!text || text.trim().length < 10) {
                            return reply.code(400).send({
                                error: 'Document parsing failed',
                                message: 'Не удалось извлечь текст из документа или файл содержит слишком мало текста'
                            })
                        }
                    } catch (e: any) {
                        return reply.code(400).send({
                            error: 'Document parsing failed',
                            message: 'Ошибка при обработке документа: ' + (e.message || 'неизвестная ошибка')
                        })
                    }
                }
            }

            // Валидация
            if (!text && !fileName) {
                return reply.code(400).send({
                    error: 'Validation failed',
                    message: 'Необходимо обновить название файла или содержимое резюме'
                })
            }

            if (fileName && fileName.length === 0) {
                return reply.code(400).send({
                    error: 'Validation failed',
                    message: 'Название файла не может быть пустым'
                })
            }

            if (text && text.length < 10) {
                return reply.code(400).send({
                    error: 'Validation failed',
                    message: 'Текст резюме слишком короткий (минимум 10 символов)'
                })
            }

            if (text && text.length > 100000) {
                return reply.code(400).send({
                    error: 'Validation failed',
                    message: 'Текст резюме слишком длинный (максимум 100,000 символов)'
                })
            }

            const current = await (prisma as any).resume.findUnique({ where: { id }, select: { userId: true } })
            if (!current) {
                return reply.code(404).send({ error: 'Not found', message: 'Резюме не найдено' })
            }

            if (current.userId !== user.id) {
                return reply.code(403).send({ error: 'Forbidden', message: 'Нет доступа к этому резюме' })
            }

            const updateData: any = {}
            if (fileName) updateData.fileName = fileName
            if (text) updateData.text = text

            const resume = await (prisma as any).resume.update({ where: { id }, data: updateData })

            if (text) {
                try {
                    await documentsApi.addDocument({
                        source_id: resume.id,
                        source_type: 'resume',
                        document_name: resume.fileName,
                        content: resume.text,
                    })
                } catch (e) {
                    console.error('Failed to update documents API:', e)
                }
            }

            return resume

        } catch (error: any) {
            console.error('Resume update error:', error)

            if (error.code === 'P2025') {
                return reply.code(404).send({
                    error: 'Not found',
                    message: 'Резюме не найдено'
                })
            }

            return reply.code(500).send({
                error: 'Internal server error',
                message: 'Произошла ошибка при обновлении резюме. Попробуйте еще раз.'
            })
        }
    })

    // Удаление
    server.delete('/resumes/:id', async (req, reply) => {
        try {
            const user = requireAuth(req as any);
            if (!user) return reply.code(401).send({ error: 'Unauthorized', message: 'Требуется авторизация' })

            const { id } = req.params as { id: string }

            if (!id) {
                return reply.code(400).send({ error: 'Validation failed', message: 'ID резюме обязателен' })
            }

            const current = await (prisma as any).resume.findUnique({ where: { id }, select: { userId: true } })
            if (!current) {
                return reply.code(404).send({ error: 'Not found', message: 'Резюме не найдено' })
            }

            if (current.userId !== user.id) {
                return reply.code(403).send({ error: 'Forbidden', message: 'Нет доступа к этому резюме' })
            }

            await (prisma as any).resume.delete({ where: { id } })
            return reply.code(204).send()

        } catch (error: any) {
            console.error('Resume deletion error:', error)

            if (error.code === 'P2025') {
                return reply.code(404).send({
                    error: 'Not found',
                    message: 'Резюме не найдено'
                })
            }

            return reply.code(500).send({
                error: 'Internal server error',
                message: 'Произошла ошибка при удалении резюме. Попробуйте еще раз.'
            })
        }
    })

    server.get('/resumes/:id', async (req, reply) => {
        try {
            const user = requireAuth(req as any);
            if (!user) return reply.code(401).send({ error: 'Unauthorized', message: 'Требуется авторизация' })

            const { id } = req.params as { id: string }

            if (!id) {
                return reply.code(400).send({ error: 'Validation failed', message: 'ID резюме обязателен' })
            }

            const resume = await (prisma as any).resume.findFirst({ where: { id, userId: user.id } })
            if (!resume) {
                return reply.code(404).send({ error: 'Not found', message: 'Резюме не найдено' })
            }

            return resume

        } catch (error: any) {
            console.error('Resume fetch error:', error)

            return reply.code(500).send({
                error: 'Internal server error',
                message: 'Произошла ошибка при получении резюме. Попробуйте еще раз.'
            })
        }
    })
}


