const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
    chunk:      { type: String },
    score:      { type: Number },
    documentId: { type: String },
    filename:   { type: String }
}, { _id: false });

const confidenceSchema = new mongoose.Schema({
    score:    { type: Number },
    label:    { type: String },
    topScore: { type: Number },
    avgScore: { type: Number }
}, { _id: false });

const interactionSchema = new mongoose.Schema({
    participantID:     { type: String, required: true },
    systemID:          { type: Number },
    userInput:         { type: String, required: true },
    botResponse:       { type: String, required: true },
    retrievalMethod:   { type: String, default: 'semantic' },
    retrievedEvidence: { type: [evidenceSchema], default: [] },
    confidenceMetrics: { type: confidenceSchema, default: () => ({}) },
    timestamp:         { type: Date, default: Date.now }
});

module.exports = mongoose.model('Interaction', interactionSchema);
