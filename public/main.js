/*********************************
 * SOCKET + GLOBAL STATE
 *********************************/
const socket = io();

let currentChannel = "general";

let localStream = null;
let remoteStream = null;
let peerConnection = null;

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

/*********************************
 * COOKIE + AUTH HELPERS
 *********************************/
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

function getUserIdFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const decoded = jwt_decode(token);
    return decoded.userId;
  } catch {
    return null;
  }
}

/*********************************
 * THEME
 *********************************/
function applyTheme() {
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-theme");
  }
}

window.toggleTheme = function () {
  document.body.classList.toggle("dark-theme");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark-theme") ? "dark" : "light"
  );
};

/*********************************
 * DOM READY
 *********************************/
window.onload = () => {
  applyTheme();

  const cookieUsername = getCookie("username");
  const cookieDisplayName = getCookie("displayName");
  if (cookieUsername) localStorage.setItem("userName", cookieUsername);
  if (cookieDisplayName) localStorage.setItem("displayName", cookieDisplayName);

  setupChat();
  setupReminders();

  const defaultGroup = localStorage.getItem("selectedGroup");
  if (defaultGroup) {
    setTimeout(() => {
      handleChannelClick("general", "text");
    }, 0);
  }
};


/*********************************
 * CHAT + MODERATION
 *********************************/
function setupChat() {
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const chatMessages = document.getElementById("chatMessages");

 messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = messageInput.value.trim();
  if (!message || !currentRoomId) return;

  const isAllowed = await moderateMessage(message);
  if (!isAllowed) return;

  socket.emit("chat-message", {
    roomId: currentRoomId,
    sender: localStorage.getItem("displayName") || "Anonymous",
    content: message,
  });

  messageInput.value = "";
});


  socket.on("chat-message", (msg) => {
    // Store message in cache
    if (!channelMessages[msg.roomId]) channelMessages[msg.roomId] = [];
    channelMessages[msg.roomId].push({ sender: msg.sender, content: msg.content });

    // Only display if in current room
    if (msg.roomId !== currentRoomId) return;

    appendMessageToChat(msg.sender, msg.content);
  });

  // Helper to append a message to the chat UI
  function appendMessageToChat(sender, content) {
    const myName = localStorage.getItem("displayName");
    const senderLabel = sender === myName ? "You" : sender;
    const div = document.createElement("div");
    div.classList.add("message");
    div.innerHTML = `<strong>${senderLabel}:</strong> ${content}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

/*********************************
 * MODERATION API
 *********************************/
async function moderateMessage(content) {
  const userId = getUserIdFromToken();
  if (!userId) return false;

  try {
    const res = await fetch("/api/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, userId })
    });

    const data = await res.json();
    return data.allowed;
  } catch {
    return false;
  }
}

/*********************************
 * CHANNELS + UI
 *********************************/
let currentRoomId = null;
let currentRoomType = null;
let lastRoomId = null;
window.handleChannelClick = function (channelName, type = "text") {
  const group = localStorage.getItem("selectedGroup");
  const displayName = localStorage.getItem("displayName") || "Anonymous";
  const cleanName = normalizeChannelName(channelName);

  // leave previous room
  if (lastRoomId) {
    socket.emit("leave-room", { roomId: lastRoomId });
  }

  currentChannel = cleanName;
  currentRoomType = type;
  currentRoomId = `${group}::${cleanName}`;
  lastRoomId = currentRoomId;

  socket.emit("join-room", {
    roomId: currentRoomId,
    roomType: "text",
    user: { name: displayName }
  });

  document.getElementById("currentChannelName").textContent = `#${cleanName}`;
  const chatMessagesDiv = document.getElementById("chatMessages");
  chatMessagesDiv.innerHTML = "";
  // Load cached messages for this room
  const cached = channelMessages[currentRoomId] || [];
  cached.forEach(msg => {
    const myName = localStorage.getItem("displayName");
    const senderLabel = msg.sender === myName ? "You" : msg.sender;
    const div = document.createElement("div");
    div.classList.add("message");
    div.innerHTML = `<strong>${senderLabel}:</strong> ${msg.content}`;
    chatMessagesDiv.appendChild(div);
  });

  if (type === "voice") joinCall(false);
  if (type === "video") joinCall(true);
};




/*********************************
 * WEBRTC (VOICE / VIDEO)
 *********************************/
async function joinCall(withVideo) {
  const group = localStorage.getItem("selectedGroup");
  const displayName = localStorage.getItem("displayName") || "Anonymous";

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: withVideo
  });

  peerConnection = new RTCPeerConnection(rtcConfig);
  localStream.getTracks().forEach(t =>
    peerConnection.addTrack(t, localStream)
  );

  peerConnection.ontrack = (e) => {
    remoteStream = e.streams[0];
    attachMediaStreams();
  };

  peerConnection.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("webrtc-ice", { candidate: e.candidate });
    }
  };

  const callRoomId = `${group}::${currentChannel}`;
  currentRoomType = withVideo ? "video" : "voice";

  socket.emit("join-room", {
    roomId: callRoomId,
    roomType: currentRoomType,
    user: { name: displayName }
  });

  attachMediaStreams();
}

window.updateDisplayName = function () {
  const input = document.getElementById("displayName");
  const newName = input.value.trim();

  if (!newName) return alert("Display name cannot be empty");

  localStorage.setItem("displayName", newName);

  if (currentRoomId && currentRoomType) {
    socket.emit("join-room", {
      roomId: currentRoomId,
      roomType: currentRoomType,
      user: { name: newName }
    });
  }

  alert("✅ Display name updated");
};

window.createChannel = function () {
  const type = prompt("Channel type? (text / voice / video)");
  if (!["text", "voice", "video"].includes(type)) {
    alert("Invalid type");
    return;
  }

  const name = prompt("Channel name?");
  if (!name) return;

  const group = localStorage.getItem("selectedGroup");

  socket.emit("create-channel", {
    group,
    channel: { name, type }
  });
};

function normalizeChannelName(name) {
  return name.replace(/^#|🔊|🎥/g, "").trim();
}

socket.on("channel-created", ({ group, channel }) => {
  if (group !== localStorage.getItem("selectedGroup")) return;

  const li = document.createElement("li");
  li.classList.add("channel-item");

  const label =
    channel.type === "text" ? `#${channel.name}` :
    channel.type === "voice" ? `🔊 ${channel.name}` :
    `🎥 ${channel.name}`;

  li.textContent = label;
  li.onclick = () => handleChannelClick(channel.name, channel.type);

  document.getElementById("channelList").appendChild(li);
});


socket.on("webrtc-offer", async ({ senderId, offer }) => {
  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("webrtc-answer", { targetId: senderId, answer });
});

socket.on("webrtc-answer", async ({ answer }) => {
  await peerConnection.setRemoteDescription(answer);
});

socket.on("webrtc-ice", ({ candidate }) => {
  peerConnection?.addIceCandidate(candidate);
});

function attachMediaStreams() {
  const modal = document.getElementById("videoCallModal");
  if (!modal) return;
  modal.querySelector("#localVideo").srcObject = localStream;
  modal.querySelector("#remoteVideo").srcObject = remoteStream;
}

function endCall() {
  peerConnection?.close();
  peerConnection = null;
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  remoteStream = null;
}

/*********************************
 * REMINDERS
 *********************************/
function setupReminders() {
  window.getReminders = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch("/api/reminders", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const reminders = await res.json();
    renderReminders(reminders);
  };

  getReminders();
}
window.showReminderForm = function () {
  document.getElementById("reminderModal").style.display = "block";
};

window.hideReminderForm = function () {
  document.getElementById("reminderModal").style.display = "none";
};


function renderReminders(reminders) {
  const list = document.getElementById("reminderList");
  if (!list) return;
  list.innerHTML = "";
  reminders.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = `${r.note} - ${new Date(r.time).toLocaleString()}`;
    list.appendChild(li);
  });
}

/*********************************
 * AI CHAT
 *********************************/
window.sendAIMessage = async function () {
  const input = document.getElementById("aiInput");
  const body = document.getElementById("aiChatBody");
  if (!input.value.trim()) return;

  body.innerHTML += `<div class="ai-msg user-msg">${input.value}</div>`;

  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: input.value })
  });

  const data = await res.json();
  body.innerHTML += `<div class="ai-msg">${data.reply || "No response"}</div>`;
  input.value = "";
};

/*********************************
 * SETTINGS
 *********************************/
window.toggleSettings = function () {
  const modal = document.getElementById("settingsModal");
  modal.style.display = modal.style.display === "block" ? "none" : "block";
};

// =============================
// MEMBER LIST UI HANDLER
// =============================
socket.on("room-members", ({ roomId, members }) => {
  // Only update if this is the current room
  if (roomId !== currentRoomId) return;
  const list = document.getElementById("serverMembers");
  if (!list) return;
  list.innerHTML = "";
  members.forEach((m) => {
    const li = document.createElement("li");
    li.textContent = m.name;
    list.appendChild(li);
  });
});

// =============================
// MESSAGE CACHE FOR CHANNELS
// =============================
const channelMessages = {}; // { roomId: [ {sender, content} ] }
