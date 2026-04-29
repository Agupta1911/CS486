require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const OpenAI = require('openai');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const Interaction = require('./models/Interaction');
const EventLog    = require('./models/EventLog');
const Document    = require('./models/Document');

const documentProcessor    = require('./services/documentProcessor');
const embeddingService     = require('./services/embeddingService');
const retrievalService     = require('./services/retrievalService');
const confidenceCalculator = require('./services/confidenceCalculator');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// ─── Multer (file upload) ─────────────────────────────────────────────────────

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
        const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
        const isText  = file.mimetype.startsWith('text/');
        cb(null, allowed.includes(file.mimetype) || isText);
    }
});

// ─── MongoDB + TF-IDF bootstrap ──────────────────────────────────────────────

async function rebuildTFIDFIndex() {
    const docs = await Document.find({ processingStatus: 'completed' }, 'chunks.text');
    const allChunks = docs.flatMap(d => d.chunks.map(c => c.text));
    retrievalService.buildTFIDFIndex(allChunks);
    console.log(`TF-IDF index built with ${allChunks.length} chunk(s)`);
}

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB Atlas');
        await rebuildTFIDFIndex();
    })
    .catch(err => console.error('MongoDB connection error:', err));

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET / — serve homepage
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST /upload-document — ingest a file, chunk it, embed chunks, store in MongoDB
app.post('/upload-document', upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded or unsupported file type.' });
    }

    // Create a placeholder document record immediately
    const doc = await Document.create({ filename: req.file.originalname });

    try {
        // 1. Extract text + chunks
        const { text, chunks } = await documentProcessor.processDocument(
            req.file.path,
            req.file.mimetype
        );

        // 2. Generate embeddings for every chunk
        const embeddings = await embeddingService.generateEmbeddings(chunks);

        // 3. Assemble chunk objects
        const processedChunks = chunks.map((chunkText, i) => ({
            index:     i,
            text:      chunkText,
            embedding: embeddings[i]
        }));

        // 4. Persist to MongoDB
        doc.text             = text;
        doc.chunks           = processedChunks;
        doc.processingStatus = 'completed';
        doc.processedAt      = new Date();
        await doc.save();

        // 5. Clean up temp file
        fs.unlinkSync(req.file.path);

        // 6. Rebuild TF-IDF index to include new chunks
        await rebuildTFIDFIndex();

        res.json({
            success:    true,
            documentId: doc._id,
            filename:   doc.filename,
            chunkCount: chunks.length
        });
    } catch (err) {
        console.error('Document processing error:', err);
        doc.processingStatus = 'failed';
        await doc.save();
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Failed to process document.' });
    }
});

// GET /documents — list uploaded documents
app.get('/documents', async (_req, res) => {
    try {
        const docs = await Document.find(
            {},
            'filename processingStatus uploadedAt processedAt'
        ).sort({ uploadedAt: -1 });
        res.json(docs);
    } catch (err) {
        console.error('Document list error:', err);
        res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
});

// POST /chat — RAG-augmented chat
app.post('/chat', async (req, res) => {
    const { history = [], input: userInput, participantID, systemID, retrievalMethod = 'semantic' } = req.body;

    if (!userInput || !participantID) {
        return res.status(400).json({ error: 'input and participantID are required' });
    }

    try {
        const method = retrievalMethod.toLowerCase();
        let retrievedEvidence = [];

        // ── Retrieval ─────────────────────────────────────────────────────────
        if (method === 'tfidf' || method === 'tf-idf') {
            // TF-IDF: use in-memory index
            const results = retrievalService.retrieveTFIDF(userInput, 3);
            retrievedEvidence = results.map(r => ({ chunk: r.chunk, score: r.score }));
        } else {
            // Semantic: embed the query, then compare against stored chunk embeddings
            const docs = await Document.find(
                { processingStatus: 'completed' },
                'chunks.text chunks.embedding'
            );
            const allChunks = docs.flatMap(d =>
                d.chunks.map(c => ({ text: c.text, embedding: c.embedding }))
            );

            if (allChunks.length > 0) {
                const queryEmbedding = await embeddingService.generateEmbedding(userInput);
                const results = retrievalService.retrieveSemantic(queryEmbedding, allChunks, 3);
                retrievedEvidence = results.map(r => ({ chunk: r.chunk, score: r.score }));
            }
        }

        // ── Confidence ────────────────────────────────────────────────────────
        const confidenceMetrics = confidenceCalculator.calculateConfidence(retrievedEvidence);

        // ── Sanitize and build conversation history for OpenAI ────────────────
        const safeHistory = Array.isArray(history)
            ? history
                .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
                .map(m => ({ role: m.role, content: String(m.content ?? '') }))
            : [];

        // ── Build RAG prompt ──────────────────────────────────────────────────
        const messages = [];
        if (retrievedEvidence.length > 0) {
            const contextText = retrievedEvidence
                .map((e, i) => `[${i + 1}] ${e.chunk}`)
                .join('\n\n');
            messages.push({
                role:    'system',
                content: `You are a helpful assistant. Use the following retrieved context to answer the user's question where relevant. If the context does not apply, answer from general knowledge.\n\nContext:\n${contextText}`
            });
        } else {
            messages.push({ role: 'system', content: 'You are a helpful assistant.' });
        }

        // ── Inject prior conversation turns then current user message ─────────
        const input = safeHistory.length === 0
            ? [{ role: 'user', content: userInput }]
            : [...safeHistory, { role: 'user', content: userInput }];

        messages.push(...input);

        // ── Call OpenAI ───────────────────────────────────────────────────────
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages
        });
        const botResponse = completion.choices[0].message.content;

        // ── Persist interaction ───────────────────────────────────────────────
        await Interaction.create({
            participantID,
            systemID,
            userInput,
            botResponse,
            retrievalMethod:   method,
            retrievedEvidence,
            confidenceMetrics
        });

        res.json({ reply: botResponse, retrievedEvidence, confidenceMetrics });
    } catch (err) {
        console.error('OpenAI or DB error:', err);
        res.status(500).json({ error: 'Failed to get response' });
    }
});

// POST /redirect-to-survey — build Qualtrics URL with participantID embedded
app.post('/redirect-to-survey', (req, res) => {
    const { participantID } = req.body;

    const qualtricsBaseUrl = 'https://usfca.qualtrics.com/jfe/form/SV_7VREZRzBnA9Jv94';
    const surveyUrl = `${qualtricsBaseUrl}?participantID=${encodeURIComponent(participantID)}`;

    res.send(surveyUrl);
});

// POST /log-event — log user interaction events to MongoDB
app.post('/log-event', async (req, res) => {
    const { participantID, systemID, eventType, elementName, timestamp } = req.body;

    if (!participantID || !eventType || !elementName) {
        return res.status(400).json({ error: 'participantID, eventType, and elementName are required' });
    }

    try {
        await EventLog.create({
            participantID,
            systemID,
            eventType,
            elementName,
            timestamp: timestamp ? new Date(timestamp) : new Date()
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Event log error:', err);
        res.status(500).json({ error: 'Failed to log event' });
    }
});

// POST /history — return last N interactions for a participant (for initial page load)
app.post('/history', async (req, res) => {
    const { participantID, limit } = req.body;

    if (!participantID) {
        return res.status(400).json({ error: 'participantID is required' });
    }

    const N = parseInt(limit) || 5;

    try {
        // Fetch the most recent N, then reverse to chronological order
        const found = await Interaction
            .find({ participantID })
            .sort({ timestamp: -1 })
            .limit(N);
        const interactions = found.reverse();
        res.json({ interactions });
    } catch (err) {
        console.error('History fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// POST /conversationHistory — return last 5 interactions for initial page load
app.post('/conversationHistory', async (req, res) => {
    const { participantID } = req.body;

    if (!participantID) {
        return res.status(400).json({ error: 'participantID is required' });
    }

    try {
        const interactions = await Interaction
            .find({ participantID })
            .sort({ timestamp: -1 })
            .limit(5);
        res.json({ interactions: interactions.reverse() });
    } catch (err) {
        console.error('Conversation history fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch conversation history' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
