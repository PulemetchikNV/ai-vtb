import { FastifyInstance } from 'fastify'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../prisma'
import { documentsApi } from '../services/documentsApi'
import { pdfParser, docParser } from '../services/pdfParser'
import { resumeConvertorChain } from '../chains/resumeConvertorChain'
import factExtractorChain from '../chains/factExtractorChain'

export default async function resumeRoutes(server: FastifyInstance) {
    // Создание: multipart (file=pdf) или JSON (text)
    server.post('/resumes', async (req: FastifyRequest, reply) => {
        let fileName = 'resume.pdf'
        let textRaw = ''

        const isMultipart = req.isMultipart && req.isMultipart()

        if (isMultipart) {
            const parts = (req as any).parts()
            console.log('PARTS', parts)
            for await (const part of parts) {
                if (part.type === 'file' && part.file) {
                    fileName = part.filename || fileName
                    const chunks: Buffer[] = []
                    for await (const c of part.file) chunks.push(c)
                    const buf = Buffer.concat(chunks)
                    try {
                        textRaw = await docParser.parseFromBuffer(buf, part.mimetype)
                    } catch (e) {
                        return reply.code(400).send({ error: 'failed to parse document', detail: String(e) })
                    }
                } else if (part.type === 'field') {
                    if (part.fieldname === 'fileName' && typeof part.value === 'string') fileName = part.value
                    if (part.fieldname === 'text' && typeof part.value === 'string') textRaw = part.value
                }
            }
        } else {
            const body = (req.body as any) || {}
            fileName = body.fileName || fileName
            textRaw = body.text || ''
        }
        if (!textRaw) return reply.code(400).send({ error: 'text is required or PDF file' })

        let [facts, text] = await Promise.all([
            (async () => await factExtractorChain.invoke({ context: textRaw, doc_type: 'резюме', max_facts: 10 }))(),
            (async () => await resumeConvertorChain.invoke({ text: textRaw }))()
        ])
        if (!Array.isArray(facts)) facts = [] as any
        if (typeof text !== 'string') text = ''

        const resume = await (prisma as any).resume.create({ data: { fileName, text_raw: textRaw, text, facts } })

        try {
            await documentsApi.addDocument({
                source_id: resume.id,
                source_type: 'resume',
                document_name: fileName,
                content: text,
            })
        } catch { }

        return reply.code(201).send(resume)
    })

    // Листинг
    server.get('/resumes', async () => {
        const items = await (prisma as any).resume.findMany({ orderBy: { createdAt: 'desc' } })
        return items
    })

    // Обновление: multipart или JSON
    server.put('/resumes/:id', async (req: FastifyRequest, reply) => {
        const { id } = req.params as { id: string }
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
                    try { text = await docParser.parseFromBuffer(buf, part.mimetype) } catch { }
                } else if (part.type === 'field') {
                    if (part.fieldname === 'fileName' && typeof part.value === 'string') fileName = part.value
                    if (part.fieldname === 'text' && typeof part.value === 'string') text = part.value
                }
            }
        } else {
            const body = (req.body as any) || {}
            fileName = body.fileName as string | undefined
            text = body.text as string | undefined
            const pdfBase64 = body.pdfBase64 as string | undefined
            if (!text && pdfBase64) {
                try { text = await pdfParser.parseFromBase64(pdfBase64) } catch { }
            }
        }

        if (!text && !fileName) return reply.code(400).send({ error: 'nothing to update' })

        const resume = await (prisma as any).resume.update({ where: { id }, data: { ...(fileName ? { fileName } : {}), ...(text ? { text } : {}) } })

        if (text) {
            try {
                await documentsApi.addDocument({
                    source_id: resume.id,
                    source_type: 'resume',
                    document_name: resume.fileName,
                    content: resume.text,
                })
            } catch { }
        }
        return resume
    })

    // Удаление
    server.delete('/resumes/:id', async (req, reply) => {
        const { id } = req.params as { id: string }
        await (prisma as any).resume.delete({ where: { id } })
        return reply.code(204).send()
    })

    server.get('/resumes/:id', async (req, reply) => {
        const { id } = req.params as { id: string }
        const resume = await (prisma as any).resume.findUnique({ where: { id } })
        if (!resume) return reply.code(404).send({ error: 'not found' })
        return resume
    })
}


