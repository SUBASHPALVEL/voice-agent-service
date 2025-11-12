const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const conversationEl = document.getElementById("conversation");
const intentBadge = document.getElementById("intentBadge");
const agentLabel = document.getElementById("activeAgent");
const sessionIdEl = document.getElementById("sessionId");

const leadEls = {
  name: document.getElementById("leadName"),
  dob: document.getElementById("leadDob"),
  email: document.getElementById("leadEmail"),
  phone: document.getElementById("leadPhone"),
  request: document.getElementById("leadRequest"),
};

let ws;
let audioContext;
let mediaStream;
let processorNode;
let activeAgentBubble = null;

startBtn.addEventListener("click", startCall);
stopBtn.addEventListener("click", stopCall);

function startCall() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const protocol = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`ws://localhost:8080`);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    setStatus("Connected - start speaking.");
    startBtn.disabled = true;
    stopBtn.disabled = false;
    startRecording();
  };

  ws.onmessage = handleMessage;
  ws.onerror = () => setStatus("Connection error.");

  ws.onclose = () => {
    setStatus("Disconnected.");
    stopRecording();
    startBtn.disabled = false;
    stopBtn.disabled = true;
    activeAgentBubble = null;
  };
}

function stopCall() {
  if (ws) ws.close();
  stopRecording();
}

function handleMessage(event) {
  if (typeof event.data === "string") {
    handleJson(event.data);
    return;
  }

  const wavBuffer = pcmToWav(event.data, 16000);
  const blob = new Blob([wavBuffer], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play().finally(() => URL.revokeObjectURL(url));
}

function handleJson(raw) {
  try {
    const payload = JSON.parse(raw);
    switch (payload.type) {
      case "session_started":
        sessionIdEl.textContent = `Session ${payload.sessionId.slice(0, 8)}`;
        break;
      case "transcript":
        appendMessage("user", payload.text);
        if (payload.lead) updateLead(payload.lead);
        break;
      case "intent":
        intentBadge.textContent = payload.intent.replace("_", " ");
        agentLabel.textContent = payload.agent;
        break;
      case "agent_text":
        updateAgentBubble(payload.text);
        break;
      case "agent_complete":
        updateAgentBubble(payload.text, true);
        if (payload.lead) updateLead(payload.lead);
        break;
      case "error":
        setStatus(payload.message || "Server error.");
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("Failed to parse message", err);
  }
}

function appendMessage(role, text) {
  const li = document.createElement("li");
  li.className = `bubble ${role}`;
  li.innerHTML = `<small>${role === "user" ? "Caller" : "Agent"}</small>${text}`;
  conversationEl.appendChild(li);
  conversationEl.scrollTop = conversationEl.scrollHeight;
}

function updateAgentBubble(text, finalize = false) {
  if (!activeAgentBubble) {
    activeAgentBubble = document.createElement("li");
    activeAgentBubble.className = "bubble agent";
    activeAgentBubble.innerHTML = "<small>Agent</small>";
    conversationEl.appendChild(activeAgentBubble);
  }
  activeAgentBubble.innerHTML = `<small>Agent</small>${text}`;
  conversationEl.scrollTop = conversationEl.scrollHeight;

  if (finalize) {
    activeAgentBubble = null;
  }
}

function updateLead(lead) {
  leadEls.name.textContent = lead.name ?? "-";
  leadEls.dob.textContent = lead.dob ?? "-";
  leadEls.email.textContent = lead.email ?? "-";
  leadEls.phone.textContent = lead.phone ?? "-";
  leadEls.request.textContent = lead.request ?? "-";
}

function setStatus(text) {
  statusEl.textContent = `Status: ${text}`;
}

async function startRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });

    const source = audioContext.createMediaStreamSource(mediaStream);
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);

    processorNode.onaudioprocess = (event) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcmBuffer = floatTo16BitPCM(input);
      if (pcmBuffer) {
        ws.send(pcmBuffer);
      }
    };

    const gain = audioContext.createGain();
    gain.gain.value = 0;

    source.connect(processorNode);
    processorNode.connect(gain);
    gain.connect(audioContext.destination);

    setStatus("Recording microphone...");
  } catch (err) {
    console.error("Mic permission denied", err);
    setStatus("Microphone access denied.");
    stopCall();
  }
}

function stopRecording() {
  if (processorNode) {
    processorNode.disconnect();
    processorNode.onaudioprocess = null;
    processorNode = null;
  }

  if (audioContext) {
    const ctx = audioContext;
    audioContext = null;
    ctx.close().catch(() => {});
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
}

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

function pcmToWav(pcmBuffer, sampleRate = 16000) {
  const bytesPerSample = 2;
  const numChannels = 1;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const pcmView = new Uint8Array(pcmBuffer);
  const wavBuffer = new ArrayBuffer(44 + pcmView.length);
  const view = new DataView(wavBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcmView.length, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, "data");
  view.setUint32(40, pcmView.length, true);
  new Uint8Array(wavBuffer, 44).set(pcmView);

  return wavBuffer;
}

function writeString(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
