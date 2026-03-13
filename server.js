const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

app.post('/chat', (req, res) => {
    const { message, retrievalMethod } = req.body;

    console.log('User message:', message);
    console.log('Retrieval method:', retrievalMethod);

    res.json({ reply: 'Message received!' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
