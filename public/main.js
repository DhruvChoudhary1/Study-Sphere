/*********************************
 * SOCKET + GLOBAL STATE
 *********************************/
const socket = io();

let currentChannel = "general";
let currentRoomId = null;
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
  if (msg.roomId !== currentRoomId) return;

  const myName = localStorage.getItem("displayName");
  const senderLabel = msg.sender === myName ? "You" : msg.sender;

  const div = document.createElement("div");
  div.classList.add("message");
  div.innerHTML = `<strong>${senderLabel}:</strong> ${msg.content}`;

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});


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
let lastRoomId = null;

window.handleChannelClick = function (channelName, type = "text") {
  const group = localStorage.getItem("selectedGroup");
  const newRoomId = `${group}::${channelName}`;

  if (lastRoomId && lastRoomId !== newRoomId) {
    socket.emit("leave-room", { roomId: lastRoomId });
  }

  currentRoomId = newRoomId;
  lastRoomId = newRoomId;
  currentChannel = channelName;

  socket.emit("join-room", {
    roomId: currentRoomId,
    user: {
      name: localStorage.getItem("displayName") || "Anonymous",
    },
  });

  document.getElementById("currentChannelName").textContent = channelName;
  document.getElementById("chatMessages").innerHTML = "";

  if (type === "voice") joinCall(false);
  else if (type === "video") joinCall(true);
};


/*********************************
 * WEBRTC (VOICE / VIDEO)
 *********************************/
async function joinCall(withVideo) {
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: withVideo
  });

  peerConnection = new RTCPeerConnection(rtcConfig);
  localStream.getTracks().forEach((t) =>
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

  socket.emit("join-room", {
    roomId: currentRoomId,
    user: { name: localStorage.getItem("displayName") || "Anonymous" }
  });

  attachMediaStreams();
}
window.updateDisplayName = function () {
  const input = document.getElementById("displayName");
  const newName = input.value.trim();

  if (!newName) {
    alert("Display name cannot be empty");
    return;
  }

  // 1️⃣ Save locally
  localStorage.setItem("displayName", newName);

  // 2️⃣ Re-join current room with updated name
  if (currentRoomId) {
    socket.emit("join-room", {
      roomId: currentRoomId,
      user: {
        name: newName,
      },
    });
  }

  alert("✅ Display name updated");
};
window.createChannel = function () {
  const type = prompt("Which type of channel? (text / voice / video)");
  if (!type || !["text", "voice", "video"].includes(type.toLowerCase())) {
    alert("Invalid channel type");
    return;
  }

  const name = prompt("Enter channel name:");
  if (!name) return;

  const channelList = document.getElementById("channelList");

  const li = document.createElement("li");
  li.textContent =
    type === "text" ? `#${name}` :
    type === "voice" ? `🔊 ${name}` :
    `🎥 ${name}`;

  li.classList.add("channel-item");

  li.onclick = () => handleChannelClick(name, type);

  channelList.appendChild(li);
};



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
