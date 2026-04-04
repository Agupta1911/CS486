/**
 * Compute the cosine similarity between two numeric vectors.
 * Returns a value in [-1, 1]; returns 0 if either vector has zero magnitude.
 * @param {number[]} vec1
 * @param {number[]} vec2
 * @returns {number}
 */
function cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
    let dot = 0, mag1 = 0, mag2 = 0;
    for (let i = 0; i < vec1.length; i++) {
        dot  += vec1[i] * vec2[i];
        mag1 += vec1[i] * vec1[i];
        mag2 += vec2[i] * vec2[i];
    }
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    if (!mag1 || !mag2) return 0;
    return dot / (mag1 * mag2);
}

module.exports = { cosineSimilarity };
