require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const OpenAI = require('openai');
const path = require('path');

const Interaction = require('./models/Interaction');
const EventLog = require('./models/EventLog');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// GET / — serve homepage
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST /chat — send message to OpenAI and log to MongoDB
app.post('/chat', async (req, res) => {
    const { message, participantID } = req.body;

    if (!message || !participantID) {
        return res.status(400).json({ error: 'message and participantID are required' });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: message }]
        });

        const botResponse = completion.choices[0].message.content;

        await Interaction.create({ participantID, userInput: message, botResponse });

        res.json({ reply: botResponse });
    } catch (err) {
        console.error('OpenAI or DB error:', err);
        res.status(500).json({ error: 'Failed to get response' });
    }
});

// POST /log-event — log user interaction events to MongoDB
app.post('/log-event', async (req, res) => {
    const { participantID, eventType, elementName, timestamp } = req.body;

    if (!participantID || !eventType || !elementName) {
        return res.status(400).json({ error: 'participantID, eventType, and elementName are required' });
    }

    try {
        await EventLog.create({
            participantID,
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

// POST /history — return chat history for a participant
app.post('/history', async (req, res) => {
    const { participantID } = req.body;

    if (!participantID) {
        return res.status(400).json({ error: 'participantID is required' });
    }

    try {
        const history = await Interaction.find({ participantID }).sort({ timestamp: 1 });
        res.json(history);
    } catch (err) {
        console.error('History fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
