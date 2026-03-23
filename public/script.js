const participantID = localStorage.getItem('participantID');
if (!participantID && window.location.pathname.includes('chat.html')) {
    window.location.href = 'index.html';
}

const inputField = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const retrievalDropdown = document.querySelector('select#retrieval-method');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');

function sendMessage() {
    const text = inputField.value.trim();

    if (text === "") {
        alert("Please enter a message before sending.");
        return;
    }

    const messageElement = document.createElement("p");
    messageElement.textContent = "You: " + text;
    messagesContainer.appendChild(messageElement);

    inputField.value = "";
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const retrievalMethod = retrievalDropdown.value;

    fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, retrievalMethod: retrievalMethod, participantID: participantID })
    })
        .then(response => response.json())
        .then(data => {
            console.log('Server response:', data);

            const botMessage = document.createElement("p");
            botMessage.textContent = 'Bot: "' + data.reply + '"';
            messagesContainer.appendChild(botMessage);

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        })
        .catch(error => console.error('Error:', error));
}

sendBtn.addEventListener('click', sendMessage);

inputField.addEventListener('keypress', function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});

retrievalDropdown.addEventListener('change', function (event) {
    const selectedMethod = event.target.value;

    if (selectedMethod !== "") {
        console.log("Retrieval method: " + selectedMethod);

        const systemMessage = document.createElement("p");
        systemMessage.textContent = "System: Retrieval method changed to " + selectedMethod;
        systemMessage.style.color = "gray";
        messagesContainer.appendChild(systemMessage);

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});

uploadBtn.addEventListener('click', function () {
    if (fileInput.files.length > 0) {
        const fileName = fileInput.files[0].name;
        console.log("Selected file: " + fileName);
    } else {
        console.log("No file chosen");
    }
});

window.onload = function() {
    if (!participantID) return;
    fetch('/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantID })
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.length > 0) {
            data.forEach(interaction => {
                const userMsg = document.createElement("p");
                userMsg.textContent = "You: " + interaction.userInput;
                messagesContainer.appendChild(userMsg);
                
                const botMsg = document.createElement("p");
                botMsg.textContent = 'Bot: "' + interaction.botResponse + '"';
                messagesContainer.appendChild(botMsg);
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    })
    .catch(err => console.error("Error loading history:", err));
};

function logEvent(eventType, elementName) {
    if (!participantID) return;
    fetch('/log-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            participantID,
            eventType,
            elementName,
            timestamp: new Date().toISOString()
        })
    }).catch(err => console.error('Error logging event:', err));
}

document.addEventListener('click', (e) => {
    let name = e.target.id || e.target.tagName;
    logEvent('click', name);
});

const logInteract = (e) => {
    let name = e.target.id || e.target.tagName;
    logEvent(e.type === 'mouseenter' ? 'hover' : e.type, name);
};

document.querySelectorAll('button, input, textarea, select').forEach(el => {
    el.addEventListener('focus', logInteract);
    el.addEventListener('mouseenter', logInteract);
});
