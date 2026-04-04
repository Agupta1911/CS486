const fs = require('fs');
const { chunkText, cleanText } = require('../utils/textUtils');

/**
 * Extract raw text from an uploaded file and split it into chunks.
 *
 * Supported mime types:
 *   - application/pdf          → pdf-parse
 *   - text/plain / text/markdown / anything else → UTF-8 read
 *
 * @param {string} filePath  Absolute path to the temp file on disk
 * @param {string} mimeType  MIME type reported by multer
 * @returns {Promise<{ text: string, chunks: string[] }>}
 */
async function processDocument(filePath, mimeType) {
    let rawText = '';

    if (mimeType === 'application/pdf') {
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        rawText = data.text;
    } else {
        // Plain text, markdown, or any other text-based format
        rawText = fs.readFileSync(filePath, 'utf-8');
    }

    const text = cleanText(rawText);
    const chunks = chunkText(text, 300, 50);

    return { text, chunks };
}

module.exports = { processDocument };
