const aiButton = document.querySelector('.ai-button');
const aiModal = document.getElementById('ai-modal');
const aiChat = document.getElementById('ai-chat');
const aiForm = document.getElementById('ai-form');
const aiPrompt = document.getElementById('ai-prompt');
const aiStatus = document.getElementById('ai-status');
const aiClose = aiModal.querySelector('.close');

function openAi() {
  aiModal.classList.add('open');
  aiModal.setAttribute('aria-hidden', 'false');
  aiPrompt.focus();
}

function closeAi() {
  aiModal.classList.remove('open');
  aiModal.setAttribute('aria-hidden', 'true');
}

function appendMessage(text, role) {
  const message = document.createElement('div');
  message.className = `ai-message ${role}`;
  message.textContent = text;
  if (aiChat.querySelector('.ai-empty')) {
    aiChat.innerHTML = '';
  }
  aiChat.append(message);
  aiChat.scrollTop = aiChat.scrollHeight;
}

aiButton.addEventListener('click', openAi);
aiClose.addEventListener('click', closeAi);
aiModal.addEventListener('click', event => { if (event.target === aiModal) closeAi(); });

aiForm.addEventListener('submit', async event => {
  event.preventDefault();
  const prompt = aiPrompt.value.trim();
  if (!prompt) return;

  appendMessage(prompt, 'user');
  aiPrompt.value = '';
  aiStatus.textContent = 'Thinking...';

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({csrf_token: window.PLAYBOX.csrfToken, prompt}),
    });
    const data = await response.json();
    if (data.answer) {
      appendMessage(data.answer, 'assistant');
      aiStatus.textContent = 'AI is ready.';
    } else {
      appendMessage(data.error || 'Sorry, something went wrong.', 'assistant');
      aiStatus.textContent = 'AI is unavailable.';
    }
  } catch (error) {
    appendMessage('Unable to connect to the AI backend.', 'assistant');
    aiStatus.textContent = 'AI is unavailable.';
  }
});
