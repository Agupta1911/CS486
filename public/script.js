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
        body: JSON.stringify({ message: text, retrievalMethod: retrievalMethod })
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
