const messagesEl = document.getElementById('messages');
const typingEl = document.getElementById('typing');
const inputEl = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const clearBtn = document.getElementById('clearBtn');
const langSel = document.getElementById('lang');
const respLangSel = document.getElementById('respLang');
const translateBtn = document.getElementById('translateBtn');
const themeToggleBtn = document.getElementById('themeToggle');
const recIndicator = document.getElementById('recIndicator');

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(text, who = 'bot', timestamp = new Date()) {
  const wrapper = document.createElement('div');
  wrapper.className = `msg ${who}`;

  const content = document.createElement('div');
  content.className = 'content';
  content.innerText = text;
  wrapper.appendChild(content);

  if (who === 'bot') {
    const speakBtn = document.createElement('button');
    speakBtn.className = 'speak-btn';
    speakBtn.title = 'Listen';
    speakBtn.setAttribute('aria-label', 'Play message audio');
    speakBtn.textContent = '🔊';
    speakBtn.addEventListener('click', () => {
      const lang = langSel.value || 'en';
      speak(text, lang);
    });
    wrapper.appendChild(speakBtn);
  }

  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.innerText = formatTime(new Date(timestamp));
  wrapper.appendChild(meta);

  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setTyping(isTyping) {
  typingEl.classList.toggle('hidden', !isTyping);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;
  const lang = langSel.value || 'en';
  let respLang = (respLangSel && respLangSel.value) || 'auto';
  if (respLang === 'auto') respLang = lang;

  addMessage(text, 'user');
  inputEl.value = '';
  setTyping(true);

  try {
    const res = await fetch('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, lang, respLang })
    });
    const data = await res.json();
    setTyping(false);

    if (data.error) {
      addMessage(`Error: ${data.error}`, 'bot');
      return;
    }
    const reply = data.reply || '';
    addMessage(reply, 'bot', data.timestamp);
  } catch (e) {
    setTyping(false);
    addMessage('Network error. Please try again.', 'bot');
  }
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

clearBtn.addEventListener('click', () => {
  messagesEl.innerHTML = '';
});

// Speech-to-Text: Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isRecording = false;
let transcriptBuffer = '';
let interimTranscript = '';

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true; // keep listening until user stops
  recognition.interimResults = true; // capture interim for UX and robustness

  recognition.onstart = () => {
    transcriptBuffer = '';
    interimTranscript = '';
    micBtn.classList.add('recording');
    micBtn.textContent = '⏹️';
    recIndicator?.classList.remove('hidden');
  };

  recognition.onresult = (event) => {
    let finalChunk = '';
    interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (res.isFinal) {
        finalChunk += res[0].transcript + ' ';
      } else {
        interimTranscript += res[0].transcript + ' ';
      }
    }
    if (finalChunk) transcriptBuffer += finalChunk;
  };

  recognition.onerror = () => {
    // Keep UX simple; stop recording state on error
    isRecording = false;
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎙️';
    recIndicator?.classList.add('hidden');
  };

  recognition.onend = () => {
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎙️';
    recIndicator?.classList.add('hidden');
    if (!isRecording) {
      // Stopped intentionally by user
      const finalText = (transcriptBuffer || interimTranscript).trim();
      if (finalText) {
        inputEl.value = finalText;
        sendMessage();
      }
    }
  };
}

micBtn.addEventListener('click', () => {
  if (!recognition) {
    alert('Speech recognition not supported in this browser.');
    return;
  }
  if (!isRecording) {
    const lang = langSel.value === 'kn' ? 'kn-IN' : 'en-IN';
    recognition.lang = lang;
    isRecording = true;
    recognition.start();
  } else {
    isRecording = false;
    recognition.stop();
  }
});

// Text-to-Speech: SpeechSynthesis API
function speak(text, lang) {
  if (!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang === 'kn' ? 'kn-IN' : 'en-IN';
  utter.rate = 1;
  utter.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

// Seed welcome message
addMessage('Namaste! Ask about crops, soil, irrigation, pests, fertilizers, or weather.', 'bot');

// Translate last bot reply using server
translateBtn?.addEventListener('click', async () => {
  // Find last bot message content
  const nodes = Array.from(messagesEl.querySelectorAll('.msg.bot .content'));
  const last = nodes[nodes.length - 1];
  if (!last) return;
  let target = (respLangSel && respLangSel.value) || 'auto';
  if (target === 'auto') target = (langSel.value || 'en');
  const text = last.innerText.trim();
  try {
    translateBtn.disabled = true;
    const res = await fetch('/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang: target })
    });
    const data = await res.json();
    if (data.translated) {
      addMessage(data.translated, 'bot');
    } else if (data.error) {
      addMessage('Translate error: ' + data.error, 'bot');
    }
  } catch (e) {
    addMessage('Network error during translation.', 'bot');
  } finally {
    translateBtn.disabled = false;
  }
});

// Theme toggle with persistence
(function initTheme() {
  try {
    const stored = localStorage.getItem('kc_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    setTheme(theme);
  } catch(_) {
    setTheme('light');
  }
})();

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (themeToggleBtn) themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  try { localStorage.setItem('kc_theme', theme); } catch(_) {}
}

themeToggleBtn?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
});


