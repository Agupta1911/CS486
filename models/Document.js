const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
    index:     { type: Number, required: true },
    text:      { type: String, required: true },
    embedding: { type: [Number], default: [] }   // vector from text-embedding-3-small
}, { _id: false });

const documentSchema = new mongoose.Schema({
    filename:         { type: String, required: true },
    text:             { type: String, default: '' },    // full extracted text
    chunks:           { type: [chunkSchema], default: [] },
    processingStatus: {
        type:    String,
        enum:    ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    processedAt:  { type: Date },
    uploadedAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Document', documentSchema);
