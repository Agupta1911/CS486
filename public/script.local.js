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
