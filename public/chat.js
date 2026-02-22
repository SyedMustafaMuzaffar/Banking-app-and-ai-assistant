/* chat.js */

(function () {
    // Inject chat HTML
    const chatHTML = `
        <div class="chat-widget-container">
            <button class="chat-toggle-btn" id="chat-toggle-btn">
                <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2 22l5-1.338C8.47 21.513 10.179 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.474 0-2.85-.387-4.04-1.06l-2.73 0.73 0.73-2.73C5.387 14.85 5 13.474 5 12c0-3.86 3.14-7 7-7s7 3.14 7 7-3.14 7-7 7z"/>
                </svg>
            </button>
            <div class="chat-window" id="chat-window">
                <div class="chat-header">
                    <h3>BankBuddy AI</h3>
                    <button class="close-chat" id="close-chat">&times;</button>
                </div>
                <div class="chat-messages" id="chat-messages">
                    <div class="message ai">
                        Hi! I'm BankBuddy. How can I help you with your banking today?
                    </div>
                </div>
                <div class="chat-input-area">
                    <input type="text" id="chat-input" placeholder="Type your message...">
                    <button class="chat-send-btn" id="chat-send-btn">
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="white"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatHTML);

    const container = document.querySelector('.chat-widget-container');
    container.style.display = 'none'; // Hide by default

    // Expose global functions for app.js to control
    window.BankBuddy = {
        show: () => container.style.display = 'block',
        hide: () => container.style.display = 'none'
    };

    const toggleBtn = document.getElementById('chat-toggle-btn');
    const closeBtn = document.getElementById('close-chat');
    const chatWindow = document.getElementById('chat-window');
    const sendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    let isThinking = false;

    // Toggle window
    toggleBtn.addEventListener('click', () => {
        chatWindow.classList.toggle('open');
        if (chatWindow.classList.contains('open')) {
            chatInput.focus();
        }
    });

    closeBtn.addEventListener('click', () => {
        chatWindow.classList.remove('open');
    });

    // Send message function
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text || isThinking) return;

        // Add user message
        addMessage(text, 'user');
        chatInput.value = '';

        // Add thinking indicator
        isThinking = true;
        const thinkingId = addThinkingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: 'You are BankBuddy, a friendly and extremely knowledgeable AI assistant. While you are part of a banking app, you can answer ANY general questions the user has (e.g., about cities, history, science, etc.). Be professional, helpful, and concise.' },
                        { role: 'user', content: text }
                    ]
                })
            });

            const data = await response.json();
            removeThinkingIndicator(thinkingId);
            isThinking = false;

            if (data.choices && data.choices[0] && data.choices[0].message) {
                addMessage(data.choices[0].message.content, 'ai');
            } else if (data.error) {
                addMessage(`Error: ${data.error}`, 'ai');
            } else {
                addMessage("I'm sorry, I'm having trouble connecting to my brain right now.", 'ai');
            }
        } catch (error) {
            console.error('Chat error:', error);
            removeThinkingIndicator(thinkingId);
            isThinking = false;
            addMessage("Oops! Something went wrong. Please try again later.", 'ai');
        }
    }

    function addMessage(text, role) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addThinkingIndicator() {
        const id = 'thinking-' + Date.now();
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.id = id;
        indicator.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return id;
    }

    function removeThinkingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // Event listeners for sending
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

})();
