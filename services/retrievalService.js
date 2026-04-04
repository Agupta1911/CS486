const { cosineSimilarity } = require('../utils/vectorUtils');

// ─── In-memory TF-IDF index ───────────────────────────────────────────────────

let tfidfIndex = null; // { chunks, tokenizedChunks, docFreq, N }

/**
 * Build (or rebuild) the in-memory TF-IDF index from an array of chunk strings.
 * Call this on server start and after every document upload.
 * @param {string[]} chunks  All chunk texts across all uploaded documents
 */
function buildTFIDFIndex(chunks) {
    if (!chunks || chunks.length === 0) {
        tfidfIndex = null;
        return;
    }

    const tokenizedChunks = chunks.map(c =>
        c.toLowerCase().split(/\W+/).filter(Boolean)
    );

    const docFreq = {};
    tokenizedChunks.forEach(tokens => {
        const seen = new Set(tokens);
        seen.forEach(t => { docFreq[t] = (docFreq[t] || 0) + 1; });
    });

    tfidfIndex = { chunks, tokenizedChunks, docFreq, N: chunks.length };
}

/**
 * Compute the TF-IDF score of a single document for a query.
 */
function _tfIdfScore(queryTokens, docTokens, docFreq, N) {
    const tf = {};
    docTokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
    let score = 0;
    queryTokens.forEach(qt => {
        if (tf[qt]) {
            const termTF = tf[qt] / docTokens.length;
            const idf = Math.log((N + 1) / (1 + (docFreq[qt] || 0)));
            score += termTF * idf;
        }
    });
    return score;
}

/**
 * Retrieve the top-k chunks using TF-IDF keyword scoring.
 * @param {string} query
 * @param {number} k
 * @returns {{ chunk: string, score: number }[]}
 */
function retrieveTFIDF(query, k = 3) {
    if (!tfidfIndex || tfidfIndex.chunks.length === 0) return [];

    const queryTokens = query.toLowerCase().split(/\W+/).filter(Boolean);

    const scored = tfidfIndex.tokenizedChunks.map((docTokens, i) => ({
        chunk: tfidfIndex.chunks[i],
        score: _tfIdfScore(queryTokens, docTokens, tfidfIndex.docFreq, tfidfIndex.N)
    }));

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .filter(r => r.score > 0);
}

/**
 * Retrieve the top-k chunks using cosine similarity on pre-computed embeddings.
 * @param {number[]} queryEmbedding  Embedding vector for the user query
 * @param {{ text: string, embedding: number[] }[]} chunksWithEmbeddings
 * @param {number} k
 * @returns {{ chunk: string, score: number }[]}
 */
function retrieveSemantic(queryEmbedding, chunksWithEmbeddings, k = 3) {
    if (!chunksWithEmbeddings || chunksWithEmbeddings.length === 0) return [];

    const scored = chunksWithEmbeddings.map(item => ({
        chunk: item.text,
        score: cosineSimilarity(queryEmbedding, item.embedding)
    }));

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .filter(r => r.score > 0);
}

module.exports = { buildTFIDFIndex, retrieveTFIDF, retrieveSemantic };
