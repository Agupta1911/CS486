// ─── Participant & system ID (URL params take priority, fall back to localStorage) ──

const params = new URLSearchParams(window.location.search);
const participantID = params.get('participantID') || localStorage.getItem('participantID');
const systemID = params.get('systemID') || localStorage.getItem('systemID');

if (!participantID && (window.location.pathname.includes('chat.html') || window.location.pathname.includes('study-workflow.html'))) {
    window.location.href = 'index.html';
}

// ─── Event logging (defined early — used by workflow + chat pages) ────────────

function logEvent(eventType, elementName) {
    if (!participantID) return;
    fetch('/log-event', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            participantID,
            systemID,
            eventType,
            elementName,
            timestamp: new Date().toISOString()
        })
    }).catch(err => console.error('Error logging event:', err));
}

// ─── Study Workflow page ──────────────────────────────────────────────────────

function markStepDone(step) {
    if (participantID) localStorage.setItem(`${participantID}_step_${step}`, 'done');
}

function updateWorkflowProgress() {
    const steps = ['demographics', 'pretask', 'task', 'prototype', 'posttask'];
    const btnIds = { demographics: 'survey-btn', pretask: 'pretask-btn', task: 'task-btn', prototype: 'prototype-btn', posttask: 'posttask-btn' };

    steps.forEach(step => {
        const done  = participantID && localStorage.getItem(`${participantID}_step_${step}`) === 'done';
        const check = document.getElementById(`check-${step}`);
        const btn   = document.getElementById(btnIds[step]);
        if (check) check.style.display = done ? 'inline' : 'none';
        if (btn)   btn.classList.toggle('step-done', done);
    });
}

// Handle ?completed=X coming back from Qualtrics or other pages
if (window.location.pathname.includes('study-workflow.html')) {
    const completed = params.get('completed');
    if (completed) {
        markStepDone(completed);
        window.history.replaceState({}, '',
            `/study-workflow.html?participantID=${encodeURIComponent(participantID)}&systemID=${encodeURIComponent(systemID)}`
        );
    }
    updateWorkflowProgress();
}

if (document.getElementById('survey-btn')) {
    document.getElementById('survey-btn').addEventListener('click', () => {
        logEvent('click', 'survey-btn');
        window.location.href = `https://usfca.qualtrics.com/jfe/form/SV_7VREZRzBnA9Jv94?participantID=${encodeURIComponent(participantID)}&systemID=${encodeURIComponent(systemID)}`;
    });
}

if (document.getElementById('pretask-btn')) {
    document.getElementById('pretask-btn').addEventListener('click', () => {
        logEvent('click', 'pretask-btn');
        window.location.href = `https://usfca.qualtrics.com/jfe/form/SV_6Dql2M1gfLix4TY?participantID=${encodeURIComponent(participantID)}&systemID=${encodeURIComponent(systemID)}`;
    });
}

if (document.getElementById('posttask-btn')) {
    document.getElementById('posttask-btn').addEventListener('click', () => {
        logEvent('click', 'posttask-btn');
        window.location.href = `https://usfca.qualtrics.com/jfe/form/SV_eLIdZEoB1pvjaiq?participantID=${encodeURIComponent(participantID)}&systemID=${encodeURIComponent(systemID)}`;
    });
}

if (document.getElementById('task-btn')) {
    document.getElementById('task-btn').addEventListener('click', () => {
        logEvent('click', 'task-btn');
        window.location.href = `/task.html?participantID=${encodeURIComponent(participantID)}&systemID=${encodeURIComponent(systemID)}`;
    });
}

if (document.getElementById('prototype-btn')) {
    document.getElementById('prototype-btn').addEventListener('click', () => {
        logEvent('click', 'prototype-btn');
        window.location.href = `/chat.html?participantID=${encodeURIComponent(participantID)}&systemID=${encodeURIComponent(systemID)}`;
    });
}

if (document.getElementById('finish-btn')) {
    document.getElementById('finish-btn').addEventListener('click', () => {
        markStepDone('prototype');
        window.location.href = `/study-workflow.html?participantID=${encodeURIComponent(participantID)}&systemID=${encodeURIComponent(systemID)}&completed=prototype`;
    });
}

// ─── Hide source viewer in baseline (systemID == 1) ─────────────────────────

if (String(systemID) !== '2') {
    const sv = document.getElementById('source-viewer');
    if (sv) sv.style.display = 'none';
}

// ─── Hide document-management panel during participant sessions ──────────────
// Documents are pre-loaded by the moderator; participants should not see upload UI.

if (params.get('participantID')) {
    const docPanel = document.getElementById('doc-panel');
    if (docPanel) docPanel.style.display = 'none';
}

// ─── Element references (chat page only) ─────────────────────────────────────

const inputField        = document.getElementById('user-input');
const sendBtn           = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const retrievalDropdown = document.getElementById('retrieval-method');
const uploadBtn         = document.getElementById('upload-btn');
const fileInput         = document.getElementById('file-input');
const uploadStatus      = document.getElementById('upload-status');
const docList           = document.getElementById('doc-list');

const isChatPage = !!inputField;

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

if (uploadBtn) uploadBtn.addEventListener('click', () => {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ─── Citation rendering ───────────────────────────────────────────────────────

function renderBotMessage(text, evidence) {
    const wrapper = document.createElement('div');
    wrapper.className = 'msg-bot-group';

    const botEl = document.createElement('div');
    botEl.className = 'msg-bot';

    const enhanced = String(systemID) === '2';

    if (!enhanced) {
        // Baseline: strip any [cite:N] the model leaked in, no chips, no sources row
        botEl.textContent = 'Bot: ' + text.replace(/\s*\[cite:\d+\]/g, '');
        wrapper.appendChild(botEl);
        return wrapper;
    }

    // Replace [cite:N] markers with inline citation chips
    let html = escapeHtml(text).replace(/\[cite:(\d+)\]/g, (_, n) => {
        const idx = parseInt(n) - 1;
        const ev  = evidence && evidence[idx];
        if (!ev) return '';
        const label = ev.filename || `Source ${n}`;
        return `<span class="citation-chip" data-index="${idx}">[${label}]</span>`;
    });

    botEl.innerHTML = 'Bot: ' + html;

    botEl.querySelectorAll('.citation-chip').forEach(chip => {
        chip.addEventListener('click', e => {
            e.stopPropagation();
            const idx = parseInt(chip.dataset.index);
            if (evidence && evidence[idx]) {
                openSourceViewer(evidence[idx]);
                logEvent('click', 'citation-chip');
            }
        });
    });

    wrapper.appendChild(botEl);

    // Sources row so chips are clickable even if the model skipped [cite:N]
    if (evidence && evidence.length > 0 && evidence.some(ev => ev.filename)) {
        const row = document.createElement('div');
        row.className = 'sources-row';
        row.innerHTML = '<span class="sources-label">Sources:</span>';

        evidence.forEach(ev => {
            if (!ev.filename) return;
            const chip = document.createElement('span');
            chip.className = 'citation-chip';
            chip.textContent = ev.filename;
            chip.addEventListener('click', e => {
                e.stopPropagation();
                openSourceViewer(ev);
                logEvent('click', 'citation-chip');
            });
            row.appendChild(chip);
        });

        wrapper.appendChild(row);
    }

    return wrapper;
}

function renderConfidenceBadge(metrics) {
    if (!metrics || metrics.score === undefined) return null;
    const pct   = (metrics.score * 100).toFixed(1);
    const badge = document.createElement('div');
    badge.className = 'confidence-badge';
    badge.textContent = `Confidence: ${pct}% (${metrics.label})`;
    return badge;
}

// ─── Interactive Source Viewer ────────────────────────────────────────────────

function openSourceViewer(evidenceItem) {
    if (!evidenceItem.documentId) {
        // No full document available — show just the chunk in the viewer
        showSourceDocument(evidenceItem.filename || 'Retrieved Chunk', evidenceItem.chunk, evidenceItem.chunk);
        return;
    }
    fetch(`/document/${evidenceItem.documentId}/text`)
        .then(r => r.json())
        .then(data => showSourceDocument(data.filename, data.text, evidenceItem.chunk))
        .catch(() => {
            // Fetch failed — still show the chunk so the viewer is useful
            showSourceDocument(evidenceItem.filename || 'Retrieved Chunk', evidenceItem.chunk, evidenceItem.chunk);
        });
}

function showSourceDocument(filename, fullText, chunkText) {
    const placeholder = document.getElementById('source-placeholder');
    const sourceDoc   = document.getElementById('source-document');

    placeholder.style.display = 'none';
    sourceDoc.style.display   = 'flex';

    document.getElementById('source-filename').textContent = filename;

    const content = document.getElementById('source-content');

    // Find chunk position in the full text for highlighting
    let start = fullText.indexOf(chunkText);
    let end   = start === -1 ? -1 : start + chunkText.length;

    // Fallback: match on the first 80 chars of the chunk
    if (start === -1) {
        const prefix = chunkText.substring(0, 80).trim();
        start = fullText.indexOf(prefix);
        end   = start === -1 ? -1 : Math.min(fullText.length, start + chunkText.length);
    }

    if (start === -1) {
        content.innerHTML = `<pre>${escapeHtml(fullText)}</pre>`;
    } else {
        const before      = escapeHtml(fullText.substring(0, start));
        const highlighted = escapeHtml(fullText.substring(start, end));
        const after       = escapeHtml(fullText.substring(end));
        content.innerHTML = `<pre>${before}<span class="citation-highlight">${highlighted}</span>${after}</pre>`;
    }

    const mark = content.querySelector('.citation-highlight');
    if (mark) mark.scrollIntoView({ behavior: 'smooth', block: 'center' });

    document.getElementById('source-statusbar').textContent =
        start === -1
            ? 'Document loaded · passage position not found'
            : '1 passage highlighted · Click ✕ to close';
}

const sourceCloseBtn = document.getElementById('source-close');
if (sourceCloseBtn) {
    sourceCloseBtn.addEventListener('click', () => {
        document.getElementById('source-document').style.display   = 'none';
        document.getElementById('source-placeholder').style.display = 'flex';
    });
}

// ─── Conversation history (in-memory, for multi-turn context) ────────────────

const conversationHistory = [];

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

    const retrievalMethod = retrievalDropdown ? retrievalDropdown.value : 'semantic';

    fetch('/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            input: text,
            history: conversationHistory,
            participantID,
            systemID,
            retrievalMethod
        })
    })
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                console.error('Chat error:', data.error);
                return;
            }

            conversationHistory.push({ role: 'user',      content: text       });
            conversationHistory.push({ role: 'assistant', content: data.reply });

            const botEl = renderBotMessage(data.reply, data.retrievedEvidence);
            messagesContainer.appendChild(botEl);

            const badge = renderConfidenceBadge(data.confidenceMetrics);
            if (badge) messagesContainer.appendChild(badge);

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        })
        .catch(err => console.error('Error:', err));
}

if (isChatPage) {
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
}

// ─── Load history on page load (chat page only) ───────────────────────────────

window.onload = function () {
    if (!participantID || !isChatPage) return;

    loadDocuments();

    fetch('/history', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ participantID })
    })
        .then(r => r.json())
        .then(data => {
            const interactions = data.interactions || [];
            if (interactions.length === 0) return;

            interactions.forEach(interaction => {
                conversationHistory.push({ role: 'user',      content: interaction.userInput  });
                conversationHistory.push({ role: 'assistant', content: interaction.botResponse });

                const userMsg = document.createElement('p');
                userMsg.className = 'msg-user';
                userMsg.textContent = 'You: ' + interaction.userInput;
                messagesContainer.appendChild(userMsg);

                const botMsg = document.createElement('div');
                botMsg.className = 'msg-bot';
                botMsg.textContent = 'Bot: ' + interaction.botResponse;
                messagesContainer.appendChild(botMsg);
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        })
        .catch(err => console.error('Error loading history:', err));
};

// ─── Global event listeners ───────────────────────────────────────────────────

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
