// OpenLoom Dev Chat UI - Client Logic

const DEFAULT_PORT = 3000;
const WS_RECONNECT_DELAY = 3000;

// State
let ws = null;
let messages = [];
let reconnectTimer = null;
let activeWizardId = null;

// DOM Elements
const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const connectionStatus = document.getElementById('connectionStatus');
const connectionText = document.getElementById('connectionText');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const newScanBtn = document.getElementById('newScanBtn');
const scanModal = document.getElementById('scanModal');
const cancelScanBtn = document.getElementById('cancelScanBtn');
const startScanBtn = document.getElementById('startScanBtn');
const scanPath = document.getElementById('scanPath');
const personalMode = document.getElementById('personalMode');

// WebSocket Connection
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    updateConnectionStatus(true);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateConnectionStatus(false);
    scheduleReconnect();
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus(false);
  };

  ws.onmessage = (event) => {
    handleMessage(event.data);
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, WS_RECONNECT_DELAY);
}

function updateConnectionStatus(connected) {
  if (connected) {
    connectionStatus.className = 'status-indicator connected';
    connectionText.textContent = 'Connected';
  } else {
    connectionStatus.className = 'status-indicator disconnected';
    connectionText.textContent = 'Disconnected';
  }
}

// Message Handling
function handleMessage(data) {
  try {
    const message = JSON.parse(data);
    
    switch (message.type) {
      case 'scan.progress':
        showProgress(message.data);
        break;
      case 'scan.completed':
        hideProgress();
        addAssistantMessage(`Scan completed! Found ${message.data.total_files} files.`);
        break;
      case 'scan.failed':
        hideProgress();
        addAssistantMessage(`Scan failed: ${message.data.error}`);
        break;
      case 'scan.started':
        // Scan has started, waiting for progress
        break;
      case 'chat.message':
        addAssistantMessage(message.data.content, message.data.html);
        break;
      case 'chat.streaming':
        updateLastAssistantMessage(message.data.content, true);
        break;
      case 'wizard.started':
        activeWizardId = message.data.wizardId;
        addAssistantMessage(`Wizard started: ${message.data.wizardType}`);
        requestWizardNext();
        break;
      case 'wizard.step':
        handleWizardStep(message.data);
        break;
      case 'wizard.cancelled':
        activeWizardId = null;
        addAssistantMessage('Wizard cancelled.');
        break;
      case 'wizard.error':
        addAssistantMessage(`Wizard error: ${message.data.error}`);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  } catch (err) {
    console.error('Failed to parse message:', err);
  }
}

function requestWizardNext() {
  if (!activeWizardId || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: 'wizard.next',
    data: { wizardId: activeWizardId },
  }));
}

function sendWizardAnswer(stepId, value) {
  if (!activeWizardId || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: 'wizard.answer',
    data: { wizardId: activeWizardId, stepId, value },
  }));
}

function handleWizardStep(data) {
  if (data.done) {
    addAssistantMessage(`Wizard finished with status: ${data.status}`);
    activeWizardId = null;
    return;
  }
  if (!data.step) return;
  const { id, type, title, message, options, initialValue } = data.step;
  if (type === 'note') {
    addAssistantMessage(`${title ? `${title}\n` : ''}${message || ''}`.trim());
    sendWizardAnswer(id, true);
    requestWizardNext();
    return;
  }
  if (type === 'confirm') {
    const answer = window.confirm(message || 'Confirm?');
    sendWizardAnswer(id, answer);
    requestWizardNext();
    return;
  }
  if (type === 'select') {
    const hint = Array.isArray(options)
      ? `\n${options.map((option, index) => `${index + 1}. ${option.label}`).join('\n')}`
      : '';
    const raw = window.prompt(`${message || 'Select'}${hint}`, '');
    const index = Number.parseInt(raw || '', 10);
    let resolved = initialValue;
    if (!Number.isNaN(index) && Array.isArray(options) && index >= 1 && index <= options.length) {
      resolved = options[index - 1].value;
    }
    sendWizardAnswer(id, resolved);
    requestWizardNext();
    return;
  }
  const value = window.prompt(message || 'Input', initialValue ?? '') ?? '';
  sendWizardAnswer(id, value);
  requestWizardNext();
}

// UI Functions
function addUserMessage(text) {
  const messageEl = createMessageElement('user', text);
  messagesEl.appendChild(messageEl);
  scrollToBottom();
}

function addAssistantMessage(text, isStreaming = false) {
  const messageEl = createMessageElement('assistant', text);
  if (isStreaming) {
    messageEl.classList.add('loading');
  }
  messagesEl.appendChild(messageEl);
  scrollToBottom();
}

function updateLastAssistantMessage(text, isStreaming = false) {
  const lastMessage = messagesEl.querySelector('.message.assistant:last-child');
  if (lastMessage) {
    lastMessage.querySelector('.message-content').innerHTML = renderMarkdown(text);
    if (!isStreaming) {
      lastMessage.classList.remove('loading');
    }
  }
}

function createMessageElement(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = renderMarkdown(content);
  
  const timeDiv = document.createElement('div');
  timeDiv.className = 'message-time';
  timeDiv.textContent = formatTime(new Date());
  
  div.appendChild(contentDiv);
  div.appendChild(timeDiv);
  
  return div;
}

function renderMarkdown(text) {
  if (typeof marked !== 'undefined') {
    return marked.parse(text);
  }
  return text.replace(/\n/g, '<br>');
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Progress
function showProgress(data) {
  progressContainer.style.display = 'block';
  const files_scanned = data.files_scanned || 0;
  const dirs_scanned = data.dirs_scanned || 0;
  progressFill.style.width = '50%'; // Indeterminate
  progressText.textContent = `Scanned: ${files_scanned} files, ${dirs_scanned} directories`;
}

function hideProgress() {
  progressContainer.style.display = 'none';
  progressFill.style.width = '0%';
}

// Send Message
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  addUserMessage(text);
  messageInput.value = '';

  if (text === '/onboarding') {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'wizard.start',
        data: { wizardType: 'onboarding' },
      }));
    } else {
      addAssistantMessage('Server is disconnected, cannot start wizard.');
    }
    return;
  }
  
  // Send to server
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'chat.message',
      data: { content: text }
    }));
  } else {
    // Demo mode - echo back
    setTimeout(() => {
      addAssistantMessage(`Received: "${text}". Connect to server for full functionality.`);
    }, 500);
  }
}

// Event Listeners
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

messageInput.addEventListener('input', () => {
  // Auto-resize
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
});

// Scan Modal
newScanBtn.addEventListener('click', () => {
  scanModal.style.display = 'flex';
  scanPath.focus();
});

cancelScanBtn.addEventListener('click', () => {
  scanModal.style.display = 'none';
});

startScanBtn.addEventListener('click', () => {
  let path = scanPath.value.trim();
  
  // Default to home directory if empty
  if (!path) {
    path = '/Users/fanyang'; // Will be sent to server for proper expansion
  }
  
  // Expand ~ to home directory on client side
  if (path.startsWith('~')) {
    path = '/Users/fanyang' + path.slice(1);
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'scan.start',
      data: {
        path: path,
        personal: personalMode.checked
      }
    }));
    addAssistantMessage(`Starting scan of ${path}...`);
  } else {
    addAssistantMessage(`Demo: Would scan ${path} (personal: ${personalMode.checked})`);
  }

  scanModal.style.display = 'none';
});

// Close modal on outside click
scanModal.addEventListener('click', (e) => {
  if (e.target === scanModal) {
    scanModal.style.display = 'none';
  }
});

// Initialize
connect();
