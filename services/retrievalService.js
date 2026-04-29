const { cosineSimilarity } = require('../utils/vectorUtils');

// ─── In-memory TF-IDF index ───────────────────────────────────────────────────

let tfidfIndex = null; // { chunkObjects, tokenizedChunks, docFreq, N }

/**
 * Build (or rebuild) the in-memory TF-IDF index.
 * @param {{ text: string, documentId: string, filename: string }[]} chunkObjects
 */
function buildTFIDFIndex(chunkObjects) {
    if (!chunkObjects || chunkObjects.length === 0) {
        tfidfIndex = null;
        return;
    }

    const tokenizedChunks = chunkObjects.map(c =>
        c.text.toLowerCase().split(/\W+/).filter(Boolean)
    );

    const docFreq = {};
    tokenizedChunks.forEach(tokens => {
        const seen = new Set(tokens);
        seen.forEach(t => { docFreq[t] = (docFreq[t] || 0) + 1; });
    });

    tfidfIndex = { chunkObjects, tokenizedChunks, docFreq, N: chunkObjects.length };
}

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
 * @returns {{ chunk: string, score: number, documentId: string, filename: string }[]}
 */
function retrieveTFIDF(query, k = 3) {
    if (!tfidfIndex || tfidfIndex.chunkObjects.length === 0) return [];

    const queryTokens = query.toLowerCase().split(/\W+/).filter(Boolean);

    const scored = tfidfIndex.tokenizedChunks.map((docTokens, i) => ({
        chunk:      tfidfIndex.chunkObjects[i].text,
        score:      _tfIdfScore(queryTokens, docTokens, tfidfIndex.docFreq, tfidfIndex.N),
        documentId: tfidfIndex.chunkObjects[i].documentId,
        filename:   tfidfIndex.chunkObjects[i].filename
    }));

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .filter(r => r.score > 0);
}

/**
 * Retrieve the top-k chunks using cosine similarity on pre-computed embeddings.
 * @param {number[]} queryEmbedding
 * @param {{ text: string, embedding: number[], documentId: string, filename: string }[]} chunksWithEmbeddings
 * @returns {{ chunk: string, score: number, documentId: string, filename: string }[]}
 */
function retrieveSemantic(queryEmbedding, chunksWithEmbeddings, k = 3) {
    if (!chunksWithEmbeddings || chunksWithEmbeddings.length === 0) return [];

    const scored = chunksWithEmbeddings.map(item => ({
        chunk:      item.text,
        score:      cosineSimilarity(queryEmbedding, item.embedding),
        documentId: item.documentId,
        filename:   item.filename
    }));

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .filter(r => r.score > 0);
}

module.exports = { buildTFIDFIndex, retrieveTFIDF, retrieveSemantic };
