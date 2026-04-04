const participantID = localStorage.getItem('participantID');
if (!participantID && window.location.pathname.includes('chat.html')) {
    window.location.href = 'index.html';
}

// ─── Element references ───────────────────────────────────────────────────────

const inputField        = document.getElementById('user-input');
const sendBtn           = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const retrievalDropdown = document.getElementById('retrieval-method');
const uploadBtn         = document.getElementById('upload-btn');
const fileInput         = document.getElementById('file-input');
const uploadStatus      = document.getElementById('upload-status');
const docList           = document.getElementById('doc-list');
const confidenceDisplay = document.getElementById('confidence-display');
const evidenceItems     = document.getElementById('evidence-items');

// ─── Document list ────────────────────────────────────────────────────────────

function loadDocuments() {
    fetch('/documents')
        .then(r => r.json())
        .then(docs => {
            docList.innerHTML = '';
            if (!docs || docs.length === 0) {
                docList.innerHTML = '<li class="no-docs">No documents uploaded yet</li>';
                return;
            }
            docs.forEach(doc => {
                const li = document.createElement('li');
                li.className = 'doc-item';
                const statusIcon = doc.processingStatus === 'completed' ? '✓' :
                                   doc.processingStatus === 'failed'    ? '✗' : '…';
                li.textContent = `${statusIcon} ${doc.filename}`;
                docList.appendChild(li);
            });
        })
        .catch(err => console.error('Error loading documents:', err));
}

// ─── Upload ───────────────────────────────────────────────────────────────────

uploadBtn.addEventListener('click', () => {
    if (!fileInput.files || fileInput.files.length === 0) {
        uploadStatus.textContent = 'Please select a file first.';
        uploadStatus.style.color = '#c00';
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('document', file);

    uploadStatus.textContent = 'Uploading and processing…';
    uploadStatus.style.color = '#555';
    uploadBtn.disabled = true;

    logEvent('click', 'upload-btn');

    fetch('/upload-document', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                uploadStatus.textContent =
                    `"${data.filename}" uploaded — ${data.chunkCount} chunk(s) indexed.`;
                uploadStatus.style.color = '#1a7a1a';
                fileInput.value = '';
                loadDocuments();
            } else {
                uploadStatus.textContent = data.error || 'Upload failed.';
                uploadStatus.style.color = '#c00';
            }
        })
        .catch(err => {
            console.error('Upload error:', err);
            uploadStatus.textContent = 'Upload failed. Check the console.';
            uploadStatus.style.color = '#c00';
        })
        .finally(() => { uploadBtn.disabled = false; });
});

// ─── Evidence panel helpers ───────────────────────────────────────────────────

function renderConfidence(metrics) {
    if (!metrics || metrics.score === undefined) {
        confidenceDisplay.innerHTML = '<p class="no-data">No confidence data.</p>';
        return;
    }

    const pct   = (metrics.score * 100).toFixed(1);
    const color = metrics.label === 'High'      ? '#1a7a1a' :
                  metrics.label === 'Medium'    ? '#8a6500' :
                  metrics.label === 'Low'       ? '#c06000' : '#c00';

    confidenceDisplay.innerHTML = `
        <div class="confidence-score" style="color:${color}">
            ${pct}% <span class="conf-label">(${metrics.label})</span>
        </div>
        <div class="conf-detail">Top: ${(metrics.topScore * 100).toFixed(1)}% &nbsp;|&nbsp; Avg: ${(metrics.avgScore * 100).toFixed(1)}%</div>
    `;
}

function renderEvidence(evidence) {
    if (!evidence || evidence.length === 0) {
        evidenceItems.innerHTML = '<p class="no-data">No relevant chunks retrieved.</p>';
        return;
    }

    evidenceItems.innerHTML = '';
    evidence.forEach((item, i) => {
        const card = document.createElement('div');
        card.className = 'evidence-card';

        const pct = (Math.min(item.score, 1) * 100).toFixed(1);

        card.innerHTML = `
            <div class="evidence-header">
                <span class="evidence-num">#${i + 1}</span>
                <span class="evidence-score">Score: ${pct}%</span>
            </div>
            <p class="evidence-text">${escapeHtml(item.chunk)}</p>
        `;
        evidenceItems.appendChild(card);
    });
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

function sendMessage() {
    const text = inputField.value.trim();
    if (text === '') {
        alert('Please enter a message before sending.');
        return;
    }

    const userEl = document.createElement('p');
    userEl.className = 'msg-user';
    userEl.textContent = 'You: ' + text;
    messagesContainer.appendChild(userEl);

    inputField.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const retrievalMethod = retrievalDropdown.value;

    fetch('/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, retrievalMethod, participantID })
    })
        .then(r => r.json())
        .then(data => {
            const botEl = document.createElement('p');
            botEl.className = 'msg-bot';
            botEl.textContent = 'Bot: "' + data.reply + '"';
            messagesContainer.appendChild(botEl);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            // Update evidence panel
            renderConfidence(data.confidenceMetrics);
            renderEvidence(data.retrievedEvidence);
        })
        .catch(err => console.error('Error:', err));
}

sendBtn.addEventListener('click', sendMessage);

inputField.addEventListener('keypress', e => {
    if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
});

retrievalDropdown.addEventListener('change', e => {
    const msg = document.createElement('p');
    msg.className = 'msg-system';
    msg.textContent = 'System: Retrieval method changed to ' + e.target.value;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    logEvent('change', 'retrieval-method');
});

// ─── Load history on page load ────────────────────────────────────────────────

window.onload = function () {
    if (!participantID) return;

    loadDocuments();

    fetch('/history', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ participantID })
    })
        .then(r => r.json())
        .then(data => {
            if (!data || data.length === 0) return;
            data.forEach(interaction => {
                const userMsg = document.createElement('p');
                userMsg.className = 'msg-user';
                userMsg.textContent = 'You: ' + interaction.userInput;
                messagesContainer.appendChild(userMsg);

                const botMsg = document.createElement('p');
                botMsg.className = 'msg-bot';
                botMsg.textContent = 'Bot: "' + interaction.botResponse + '"';
                messagesContainer.appendChild(botMsg);
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        })
        .catch(err => console.error('Error loading history:', err));
};

// ─── Event logging ────────────────────────────────────────────────────────────

function logEvent(eventType, elementName) {
    if (!participantID) return;
    fetch('/log-event', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            participantID,
            eventType,
            elementName,
            timestamp: new Date().toISOString()
        })
    }).catch(err => console.error('Error logging event:', err));
}

document.addEventListener('click', e => {
    const name = e.target.id || e.target.tagName;
    logEvent('click', name);
});

const logInteract = e => {
    const name = e.target.id || e.target.tagName;
    logEvent(e.type === 'mouseenter' ? 'hover' : e.type, name);
};

document.querySelectorAll('button, input, textarea, select').forEach(el => {
    el.addEventListener('focus',      logInteract);
    el.addEventListener('mouseenter', logInteract);
});
