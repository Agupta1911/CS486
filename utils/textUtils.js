/**
 * Split text into overlapping chunks of approximately `chunkSize` words.
 * @param {string} text - Input text
 * @param {number} chunkSize - Target words per chunk
 * @param {number} overlap - Words to overlap between consecutive chunks
 * @returns {string[]} Array of chunk strings
 */
function chunkText(text, chunkSize = 300, overlap = 50) {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    let i = 0;
    while (i < words.length) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        if (chunk.trim()) chunks.push(chunk);
        i += chunkSize - overlap;
        if (i + overlap >= words.length) break;
    }
    // Capture any remaining words as a final chunk
    if (i < words.length) {
        const last = words.slice(i).join(' ');
        if (last.trim() && last !== chunks[chunks.length - 1]) chunks.push(last);
    }
    return chunks;
}

/**
 * Normalise whitespace and remove non-printable characters.
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
    return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = { chunkText, cleanText };
