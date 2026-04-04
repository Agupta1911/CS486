/**
 * Compute a confidence / explainability score from the retrieved evidence chunks.
 *
 * Scores from semantic retrieval are cosine similarities [0, 1].
 * Scores from TF-IDF can be any non-negative number, so we normalise them first.
 *
 * The final confidence is a weighted combination of the top score (0.6) and the
 * mean score (0.4), giving more weight to the single best match.
 *
 * @param {{ chunk: string, score: number }[]} retrievedChunks
 * @returns {{ score: number, label: string, topScore: number, avgScore: number }}
 */
function calculateConfidence(retrievedChunks) {
    if (!retrievedChunks || retrievedChunks.length === 0) {
        return { score: 0, label: 'No evidence', topScore: 0, avgScore: 0 };
    }

    let scores = retrievedChunks.map(c => c.score);

    // Normalise to [0, 1] when TF-IDF produces values > 1
    const maxRaw = Math.max(...scores);
    if (maxRaw > 1) {
        scores = scores.map(s => s / maxRaw);
    }

    const topScore = Math.max(...scores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const confidence = 0.6 * topScore + 0.4 * avgScore;

    let label;
    if (confidence >= 0.7)      label = 'High';
    else if (confidence >= 0.45) label = 'Medium';
    else if (confidence >= 0.2)  label = 'Low';
    else                         label = 'Very Low';

    return {
        score:    parseFloat(confidence.toFixed(4)),
        label,
        topScore: parseFloat(topScore.toFixed(4)),
        avgScore: parseFloat(avgScore.toFixed(4))
    };
}

module.exports = { calculateConfidence };
