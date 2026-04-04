const OpenAI = require('openai');

const EMBEDDING_MODEL = 'text-embedding-3-small';

// Lazy-initialise so the client is created after dotenv has loaded the key
let _openai = null;
function getClient() {
    if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _openai;
}

/**
 * Generate an embedding vector for a single text string.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function generateEmbedding(text) {
    const response = await getClient().embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000) // stay well within token limit
    });
    return response.data[0].embedding;
}

/**
 * Generate embeddings for an array of text strings.
 * Processes sequentially to avoid rate-limit bursts.
 * @param {string[]} chunks
 * @returns {Promise<number[][]>}
 */
async function generateEmbeddings(chunks) {
    const embeddings = [];
    for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk);
        embeddings.push(embedding);
    }
    return embeddings;
}

module.exports = { generateEmbedding, generateEmbeddings };
