

let currentChannel = "general";
let localStream;
let remoteStream;
let peerConnection;
const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};


const socket = io();



console.log("🔌 Connecting to server...");


socket.on("connect", () => {
  console.log("✅ Connected to server via Socket.IO");
});

function getUserIdFromToken() {
  const token = localStorage.getItem("token"); // Retrieve the token from localStorage
  if (!token) {
    alert("You are not logged in!");
    return null;
  }

  try {
    const decoded = jwt_decode(token); // Use the global `jwt_decode` function
    return decoded.userId; // Extract the userId from the token
  } catch (err) {
    console.error("Error decoding token:", err);
    alert("Invalid token. Please log in again.");
    return null;
  }
}
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}





window.onload = () => {
  // Apply saved theme
 // Apply saved theme
   if (localStorage.getItem("theme") === "dark") {
     document.body.classList.add("dark-theme");
  }
  
    // ... your existing code above ...
  
    // 🔥 Define handleChannelClick function
    function handleChannelClick(channelName, channelType = "text") {
      if (currentChannel !== channelName) {
        endCall();
      }
  
      currentChannel = channelName;
      const currentChannelName = document.getElementById("currentChannelName");
      if (currentChannelName) currentChannelName.textContent = channelName;
  
      if (channelType === "voice" || channelName.includes("Voice")) {
        initiateCall(false);
        chatMessages.innerHTML = `<div class="channel-msg">Joined 🔊 Voice Channel</div>`;
      } else if (channelType === "video" || channelName.includes("Video")) {
        initiateCall(true);
        chatMessages.innerHTML = `<div class="channel-msg">Joined 🎥 Video Channel</div>`;
      } else {
        endCall();
        chatMessages.innerHTML = `<div class="channel-msg">Welcome to ${channelName}</div>`;
      }
    }
  
    // 🔥 Attach to window
    window.handleChannelClick = handleChannelClick;
  
      

// Helper to read cookies
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
  }

// Sync username and displayName from cookies to localStorage
  const cookieUsername = getCookie("username");
  const cookieDisplayName = getCookie("displayName");

  if (cookieUsername) localStorage.setItem("userName", cookieUsername);
  if (cookieDisplayName) localStorage.setItem("displayName", cookieDisplayName);

// Populate saved display name
  const savedName = localStorage.getItem("displayName") || localStorage.getItem("userName");
  const displayInput = document.getElementById("displayName");
  if (savedName && displayInput) {
  displayInput.value = savedName;
 }
  // Global variables
  let localStream = null;
  let remoteStream = null;
  let peerConnection = null;
  let currentChannel = null;
  const config = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  };

  // DOM Elements
  
  const messagesList = document.getElementById("messages");

  const serverPage = document.getElementById("serverPage");
  const dashboard = document.getElementById("dashboard");
  const userServerList = document.getElementById("userServerList");
  const channelList = document.getElementById("channelList");
  const chatMessages = document.getElementById("chatMessages");
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  const leaveCallBtn = document.getElementById("leaveCallBtn");
  const messageInput = document.getElementById("messageInput"); // or your actual input's ID
  const messageForm = document.getElementById("messageForm"); // and this too, if not already defined

  // 🔥 Fix added here
  
  const messagesContainer = document.getElementById("chatMessages");

// Moderation API wrapper
async function moderateMessage(content) {
  if (!content || content.trim() === "") {
    alert("Message cannot be empty.");
    return false;
  }

  const userId = getUserIdFromToken(); // Extract userId from the token
  if (!userId) {
    alert("User ID is missing. Please log in again.");
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

  try {
    const response = await fetch("/api/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, userId }), // Include userId in the request body
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 403) {
        console.error("Moderation failed: API not enabled or invalid API key.");
        alert("Moderation service is unavailable. Please contact support.");
      } else if (response.status === 429) {
        console.error("Moderation failed: Rate limit exceeded.");
        alert("You are sending messages too quickly. Please wait and try again.");
      } else {
        console.error("Moderation failed:", errorData.error || `Status ${response.status}`);
        alert("An error occurred during moderation. Please try again later.");
      }
      return false; // Default to blocking on error
    }

    const { allowed } = await response.json();
    console.log("Moderation response:", allowed); // Debugging log
    return allowed; // true if "Allow", false if "Block"
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("Moderation request timed out.");
      alert("The moderation service took too long to respond. Please try again later.");
    } else {
      console.error("Moderation failed:", err.message);
      alert("An unexpected error occurred. Please try again later.");
    }
    return false; // Default to blocking on error
  }
}

async function createReminder() {
  const title = document.getElementById("reminderTitle").value;
  const datetime = document.getElementById("reminderDatetime").value;
  const notes = document.getElementById("reminderNotes").value;

  if (!title || !datetime) {
    alert("Please fill in the required fields.");
    return;
  }

  try {
    const response = await fetch("/reminders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include", // important: send cookies
      body: JSON.stringify({ title, datetime, notes })
    });

    const data = await response.json();

    if (response.ok) {
      alert("Reminder created!");
      hideReminderForm();
      fetchReminders(); // Reload reminders
    } else {
      alert(data.message || "Failed to create reminder.");
    }
  } catch (error) {
    console.error("Reminder error:", error);
    alert("Something went wrong.");
  }
}



// Handle message form submission
messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  try {
    // Call the moderation API
    const isAllowed = await moderateMessage(message);

    if (isAllowed) {
      console.log("Message allowed:", message);
      const displayName = localStorage.getItem("displayName") || "You";

      // Create and append the message element
      const messageEl = document.createElement("div");
      messageEl.classList.add("message");
      messageEl.innerHTML = `<strong>${displayName}:</strong> ${message}`;
      messagesContainer.appendChild(messageEl);

      // Emit the message to the server
      socket.emit("chatMessage", { message, channel: currentChannel });
    } else {
      alert("⚠️ This message was blocked by moderation. Please stay on-topic.");
    }
  } catch (err) {
    console.error("Error submitting message:", err);
    alert("❌ An error occurred while sending your message. Please try again.");
  }

  // Clear the input field
  messageInput.value = "";
}); 

  // Attach local/remote media streams
  function attachMediaStreams() {
    if (localVideo && localStream) localVideo.srcObject = localStream;
    if (remoteVideo && remoteStream) remoteVideo.srcObject = remoteStream;
  }

  // Start call
  async function initiateCall(useVideo) {
    endCall(); // Leave any current call before joining new one

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: useVideo,
        audio: true
      });

      peerConnection = new RTCPeerConnection(config);

      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      peerConnection.ontrack = (event) => {
        const [stream] = event.streams;
        if (!remoteStream) {
          remoteStream = stream;
          attachMediaStreams();
        }
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            candidate: event.candidate,
            channel: currentChannel
          });
        }
      };

      attachMediaStreams();
      socket.emit("join-call", currentChannel);
      document.getElementById("callControls").style.display = "flex";

      if (leaveCallBtn) leaveCallBtn.style.display = "block";


    }
     catch (err) {
      console.error("Media error:", err);
      alert("Could not access your mic/cam.");
    }
  }

  function endCall() {
    if (peerConnection) peerConnection.close();
    peerConnection = null;
  
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
  
    remoteStream = null;
  
    const modal = document.getElementById("videoCallModal");
    if (modal) modal.remove();
  
    // Hide call controls bar
    document.getElementById("callControls").style.display = "none";
  
    // Inform server you left the call
    socket.emit("leave-call", currentChannel);
  }
  

  if (leaveCallBtn) {
    leaveCallBtn.onclick = endCall;
  }
  
  

  window.joinStudyGroup = function (groupName) {
    console.log("Joining group:", groupName);
    if (serverPage) serverPage.style.display = "none";
    if (dashboard) dashboard.style.display = "flex";

    const channelName = document.getElementById("currentChannelName");
    if (channelName) channelName.textContent = `${groupName} | #general`;

    const channels = [
      { name: "#general", type: "text" },
      { name: "#doubt", type: "text" },
      { name: "#resources", type: "text" },
      { name: "🔊 Voice Room", type: "voice" },
      { name: "🎥 Video Room", type: "video" }
    ];

    if (channelList) {
      channelList.innerHTML = "";
      channels.forEach((channel) => {
        const li = document.createElement("li");
        li.textContent = channel.name;
        li.classList.add("channel-item");
    
        // Pass both name and type
        li.addEventListener("click", () => handleChannelClick(channel.name, channel.type));
    
        channelList.appendChild(li);
      });
    }
    

    if (userServerList) {
      const existing = Array.from(userServerList.children).some(
        (li) => li.textContent === groupName
      );
      if (!existing) {
        const li = document.createElement("li");
        li.textContent = groupName;
        userServerList.appendChild(li);
      }
    }
    


  };

  window.toggleTheme = function () {
    document.body.classList.toggle("dark-theme");
    const theme = document.body.classList.contains("dark-theme") ? "dark" : "light";
    localStorage.setItem("theme", theme);
  };
  const leaveBtn = document.querySelector("#callControls .leave-btn");
if (leaveBtn) {
  leaveBtn.onclick = endCall;

}
window.addEventListener('DOMContentLoaded', () => {
  fetchReminders();
});


};







socket.on("chat message", (data) => {
  if (data.channel === currentServer) {
    const li = document.createElement("li");
    li.textContent = `[${data.username}] ${data.text}`;
    messagesList.appendChild(li);
  }
}); 


// When another user joins and we are the first — create offer
socket.on("ready-for-offer", async () => {
  if (peerConnection) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("send-offer", {
      offer,
      channel: currentChannel
    });
  }
});

socket.on("receive-offer", async ({ offer }) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("send-answer", {
      answer,
      channel: currentChannel
    });
  }
});

socket.on("receive-answer", async ({ answer }) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

socket.on("ice-candidate", ({ candidate }) => {
  if (peerConnection && candidate) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});


function showForm(type) {
  const loginForm = document.getElementById("loginForm");
  const authOptions = document.getElementById("authOptions");
  authOptions.style.display = "none";
  loginForm.style.display = "block";

  loginForm.innerHTML = `
    <h3>${type === 'signup' ? 'Sign Up' : 'Sign In'}</h3>
    <form onsubmit="return handleAuth(event, '${type}')">
      <input type="text" id="name" placeholder="Full Name" ${type === 'signin' ? 'style="display:none"' : ''} required>
      <input type="email" id="email" placeholder="Email ID" required>
      <input type="password" id="password" placeholder="Password" required>
      <label style="display: block; margin-top: 10px;">
        <input type="checkbox" id="termsCheckbox" required>
        I agree to the <a href="terms.html" target="_blank">Terms and Conditions</a>
      </label>
      <button type="submit">${type === 'signup' ? 'Sign Up' : 'Sign In'}</button>
    </form>
  `;
}

async function loginUser(email, password) {
  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(`❌ ${data.error || 'Login failed'}`);
      return;
    }

    // ✅ Save token in localStorage
    localStorage.setItem("token", data.token);
    alert("✅ Login successful!");

    // Redirect to dashboard
    window.location.href = "/study_website.html";
  } catch (err) { 
    console.error('Login error:', err);
    alert("❌ Server error during login.");
  }
}
async function signupUser(name, email, password) {
  try {
    const response = await fetch('/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(`❌ ${data.error || 'Signup failed'}`);
      return;
    }

    // ✅ Save token to localStorage
    localStorage.setItem("token", data.token);
    alert("✅ Signup successful!");

    // Redirect to dashboard
    window.location.href = "/study_website.html";
  } catch (err) {
    console.error('Signup error:', err); 
    alert("❌ Server error during signup.");
  }
}

 
async function handleAuth(event, type) {
  event.preventDefault();

  const name = document.getElementById("name")?.value; // Optional for signup
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  // Validate input fields
  if (!email || !password || (type === "signup" && !name)) {
    alert("Please fill in all required fields.");
    return;
  }

  try {
    const endpoint = type === "signup" ? "/auth/signup" : "/auth/login";
    const body = type === "signup"
      ? { name, email, password }
      : { email, password };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`${type === "signup" ? "Signup" : "Login"} successful:`, data);

      // Save token to localStorage
      localStorage.setItem("token", data.token);

      alert(`✅ ${type === "signup" ? "Signup" : "Login"} successful!`);
      window.location.href = "/study_website.html"; // Redirect to dashboard
    } else {
      console.error(`${type === "signup" ? "Signup" : "Login"} failed:`, data);
      alert(data.error || `${type === "signup" ? "Signup" : "Login"} failed. Please try again.`);
    }
  } catch (err) {
    console.error(`${type === "signup" ? "Signup" : "Login"} error:`, err);
    alert("An error occurred. Please try again later.");
  }
}







  
  


function toggleSettings() {
  const modal = document.getElementById("settingsModal");
  modal.style.display = modal.style.display === "none" ? "block" : "none";
}



function toggleTheme() {
  document.body.classList.toggle("dark-theme");
  localStorage.setItem("theme", document.body.classList.contains("dark-theme") ? "dark" : "light");
}


function switchChannel(channelName) {
  currentChannel = channelName;
  document.getElementById("currentChannelName").textContent = channelName;
  document.getElementById("chatMessages").innerHTML = ""; // clear old messages

  socket.emit("join channel", channelName);

  // Fetch past messages from the server
  fetch(`/messages/${channelName}`)
    .then(res => res.json())
    .then(data => {
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(msg => {
          addMessageToChat(`${msg.username}: ${msg.text}`);
        });
      }
    })
    .catch(err => {
      console.error("Failed to load messages:", err);
    });
}

function addChannelToUI(type, name) {
  const li = document.createElement("li");

  // Add emoji prefix based on type
  let displayName = name;
  if (type === "voice") displayName = `🔊 ${name}`;
  else if (type === "video") displayName = `🎥 ${name}`;
  else displayName = `#${name}`;

  li.textContent = displayName;
  li.classList.add("channel-item");
  li.addEventListener("click", () => handleChannelClick(displayName, type));
  channelList.appendChild(li);
}



function createChannel() {
  const type = prompt("Which type of channel would you like to create? (text / voice / video)").toLowerCase();
  if (!["text", "voice", "video"].includes(type)) return alert("❌ Invalid channel type.");

  const name = prompt(`Enter the name for the ${type} channel:`).trim();
  if (!name) return;

  const formattedName = name.toLowerCase().replace(/\s+/g, "-");

  let saved = JSON.parse(localStorage.getItem("customChannels") || "[]");
  saved.push({ type, name: formattedName });
  localStorage.setItem("customChannels", JSON.stringify(saved));

  addChannelToUI(type, formattedName);
}



// In loadChannels()
function loadChannels() {
  const textChannels = ["general", "doubt", "resources"];
  const voiceChannels = ["🔊 Voice Room", "📹 Video Room"];
  const channelList = document.getElementById("channelList");
  channelList.innerHTML = "";

  textChannels.forEach(c => addChannelToUI("text", c));
  voiceChannels.forEach(vc => addChannelToUI(vc.includes("Voice") ? "voice" : "video", vc.split(" ")[1]));

  const saved = JSON.parse(localStorage.getItem("customChannels") || "[]");
  saved.forEach(ch => addChannelToUI(ch.type, ch.name));
}

function joinChannel(channelName) {
  const username = localStorage.getItem("userName") || "Anonymous";
  const displayName = localStorage.getItem("displayName") || username;

  socket.emit("join channel", { username, displayName, channel: channelName });
}

const memberListBox = document.getElementById("serverMembers");
const callListBox = document.getElementById("activeCallMembers");

// Listen for member list updates
socket.on("updateMembers", (data) => {
  console.log("Received member list:", data);
  memberListBox.innerHTML = ""; // Clear the current list
  data.members.forEach((member) => {
    const li = document.createElement("li");
    li.textContent = member.displayName || member.username || "Anonymous"; // Use displayName if available
    memberListBox.appendChild(li);
  });
});

// Listen for call list updates
socket.on("updateCallList", (data) => {
  console.log("Received call list:", data);
  callListBox.innerHTML = ""; // Clear the current list
  data.inCall.forEach((member) => {
    const li = document.createElement("li");
    li.textContent = member.displayName || member.username || "Anonymous"; // Use displayName if available
    callListBox.appendChild(li);
  });
});

function sendMessage() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  const username = localStorage.getItem("userName") || "Anonymous"; // ✅ Just this one

  if (message) {
    // Save to DB
    fetch('/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, text: message, channel: currentChannel })
    });

    // Emit to others
    socket.emit("chat message", {
      username,
      text: message,
      channel: currentChannel,
    });

    input.value = ""; // clear input
  }
}




function addMessageToChat(msg) {
  const chat = document.getElementById("chatMessages");
  const msgElem = document.createElement("div");
  msgElem.textContent = msg;
  chat.appendChild(msgElem);
  chat.scrollTop = chat.scrollHeight;
}
let currentServer = "general"; // Default server
messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!messageInput.value || !currentServer) {
    alert("Please select a server before sending a message.");
    return;
  }

  const messageData = {
    username: localStorage.getItem("userName") || "Anonymous",
    displayName: localStorage.getItem("displayName"),
    text: messageInput.value,
    channel: currentServer, // Use the current server
  };

  // Save to backend
  fetch("/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messageData),
  });

  // Emit to server via Socket.IO
  socket.emit("chat message", messageData);
});

socket.on('receive-message', (data) => {
  const msgContainer = document.getElementById('chatMessages');
  if (!msgContainer) return;

  const msg = document.createElement('div');
  msg.classList.add('message');
  msg.innerText = `${data.sender}: ${data.content}`;
  msgContainer.appendChild(msg);

  // Scroll to bottom
  msgContainer.scrollTop = msgContainer.scrollHeight;
});



function attachMediaStreams() {
  let modal = document.getElementById("videoCallModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "videoCallModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h2>In Call - ${currentChannel}</h2>
        <video id="localVideo" autoplay muted playsinline></video>
        <video id="remoteVideo" autoplay playsinline></video>
        <br>
        <button onclick="endCall()">Leave Call</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const localEl = modal.querySelector("#localVideo");
  const remoteEl = modal.querySelector("#remoteVideo");

  if (localEl && localStream) localEl.srcObject = localStream;
  if (remoteEl && remoteStream) remoteEl.srcObject = remoteStream;

  modal.style.display = "flex";

  // Hide chat input during calls
  const chatArea = document.getElementById("message-form");
  if (chatArea) chatArea.style.display = "none";
}

function endCall() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
    remoteStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  const modal = document.getElementById("videoCallModal");
  if (modal) modal.remove();

  if (leaveCallBtn) leaveCallBtn.style.display = "none";

  // Re-enable chat input
  const chatArea = document.getElementById("message-form");
  if (chatArea) chatArea.style.display = "flex";
}


function toggleAIChat() {
  const modal = document.getElementById("aiChatModal");
  modal.style.display = modal.style.display === "none" ? "block" : "none";
}

async function sendAIChat() {
  const input = document.getElementById("aiInput").value;
  if (!input.trim()) return;

  const chatBody = document.getElementById("aiChatBody");
  chatBody.innerHTML += `<div class="ai-msg user-msg">${input}</div>`;

  try {
    const response = await fetch('/api/ai', { // <-- updated here
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: input }), // <-- match with /api/ai
    });

    const data = await response.json();
    const aiReply = data.reply || "Sorry, I couldn't process that.";
    chatBody.innerHTML += `<div class="ai-msg">${aiReply}</div>`;
  } catch (err) {
    chatBody.innerHTML += `<div class="ai-msg error">Error reaching AI.</div>`;
  }

  document.getElementById("aiInput").value = '';
}

function closeAIChat() {
  const modal = document.getElementById("aiChatModal");
  modal.style.display = "none";
  document.getElementById("aiChatBody").innerHTML = ""; // Clear chat history
} 


function fetchAIResponse(message) {
  fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prompt: message })
  })
    .then(res => res.json())
    .then(data => {
      if (data.reply) {
        addMessageToChat(`AI: ${data.reply}`);
      }
    })
    .catch(err => {
      console.error("AI fetch error:", err);
      addMessageToChat("AI: Sorry, I couldn't respond right now.");
    });
}



function sendAIMessage() {
  const input = document.getElementById("ai-chat-input");
  const message = input.value.trim();
  if (message) {
    addMessageToChat(`You: ${message}`);
    fetchAIResponse(message);
    input.value = ""; // clear input
  }
}


function closeSettings() {
  const modal = document.getElementById("settingsModal");
  modal.style.display = "none";
}


document.addEventListener('DOMContentLoaded', () => {
  ; function fetchGroups() {
    const groupSelect = document.getElementById("groupSelect");
    const groupError = document.getElementById("groupError");

    // Check if groupSelect exists
    if (!groupSelect) {
        console.error("Element with id 'groupSelect' not found.");
        return;
    }

    // Check if groupError exists
    if (!groupError) {
        console.error("Element with id 'groupError' not found.");
        return;
    }

    try {
        // Example: Modify the style or populate the element
        groupSelect.style.display = "block"; // Ensure it's visible
        groupSelect.innerHTML = "<p>Group options will appear here.</p>";

        // Hide the error message if everything is successful
        groupError.style.display = "none";
    } catch (error) {
        console.error("Error fetching groups:", error);

        // Display an error message to the user
        groupError.style.display = "block";
        groupError.textContent = "Failed to load groups. Please try again later.";
    }
}

fetchGroups();
  const reminderForm = document.getElementById('reminderForm');
  if (reminderForm) {
    reminderForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const token = localStorage.getItem('token'); // Retrieve the token from localStorage
      if (!token) {
        alert("You're not logged in!");
        window.location.href = "/login"; // Redirect to login page
        return;
      }

      const time = document.getElementById('reminderTime').value;
      const note = document.getElementById('reminderNote').value;

      if (!time || !note) return alert('Please enter both date/time and a note.');

      try {
        const response = await fetch('/api/reminders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, // Include the token in the Authorization header
          },
          body: JSON.stringify({
            time,
            note,
          }),
        });

        const result = await response.json();
        if (response.ok) {
          alert('Reminder set!');
          document.getElementById('reminderForm').reset();
          fetchReminders(); // Load updated list
        } else {
          console.error('Failed to set reminder:', result);
          alert(result.error || 'Failed to set reminder.');
        }
      } catch (err) {
        console.error('Error setting reminder:', err);
        alert('❌ Failed to set reminder due to network/server error.');
      }
      if (!token) {
        alert("You're not logged in!");
        window.location.href = "/index.html"; // Redirect to login page
        return;
      }
    });
  }
});


// Fetch all reminders

async function fetchReminders() {
  const token = localStorage.getItem('token'); // Retrieve the token from localStorage

  if (!token) {
    alert("You're not logged in!");
    window.location.href = "/login"; // Redirect to login page
    return;
  }

  try {
    const response = await fetch('/api/reminders', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`, // Include the token in the Authorization header
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error:', error);
      alert(`❌ ${error.error || 'Failed to fetch reminders.'}`);
      return;
    }

    const reminders = await response.json();
    console.log('📅 Reminders:', reminders);

    // Optionally render reminders to UI
    renderReminders(reminders); // Call a function to display reminders in the UI
  } catch (err) {
    console.error('Fetch error:', err);
    alert('❌ Failed to fetch reminders due to network/server error.');
  }
  if (!token) {
    alert("You're not logged in!");
    window.location.href = "/index.html"; // Redirect to login page
    return; 
  }
}


function renderReminders(reminders) {
  const reminderList = document.getElementById('reminderList'); // Ensure this element exists in your HTML
  if (!reminderList) return;

  reminderList.innerHTML = ''; // Clear existing reminders

  reminders.forEach((reminder) => {
    const li = document.createElement('li');
    li.textContent = `${reminder.note} - ${new Date(reminder.time).toLocaleString()}`;
    reminderList.appendChild(li);
  });
}
// Create a new reminder
window.createReminder = function () {
  const token = localStorage.getItem('token'); // Retrieve the token from localStorage

  if (!token) {
    alert("You're not logged in!");
    window.location.href = "/login"; // Redirect to login page
    return;
  }

  const time = document.getElementById('reminderDatetime').value;
  const note = document.getElementById('reminderTitle').value;
  const notes = document.getElementById('reminderNotes').value;

  if (!time || !note) {
    alert('Please fill in both time and note.');
    return;
  }

  fetch('/api/reminders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`, // Include the token in the Authorization header
    },
    credentials: 'include', // Include cookies for authentication
    body: JSON.stringify({ time, note, notes }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Failed to create reminder');
      }
      return response.json();
    })
    .then((data) => {
      console.log('Reminder added:', data);
      hideReminderForm();
      getReminders(); // Refresh the reminder list
    })
    .catch((error) => {
      if (error.message.includes("401")) {
        alert("Your session has expired. Please log in again.");
        window.location.href = "/login"; // Redirect to login page
      } else {
        console.error('Error creating reminder:', error);
        alert('Failed to add reminder. Please try again.');
      }
    });
};
// Attach the hideReminderForm function to the window object
window.hideReminderForm = function () {
  document.getElementById("reminderModal").style.display = "none";
};

// Attach the showReminderForm function to the window object
window.showReminderForm = function () {
  document.getElementById("reminderModal").style.display = "block";
};

window.getReminders = async function () {
  const token = localStorage.getItem('token'); // Retrieve the token from localStorage

  if (!token) {
    alert("You're not logged in!");
    window.location.href = "/login"; // Redirect to login page
    return;
  }

  try {
    const response = await fetch('/api/reminders', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`, // Include the token in the Authorization header
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error:', error);
      alert(`❌ ${error.error || 'Failed to fetch reminders.'}`);
      return;
    }

    const reminders = await response.json();
    console.log('📅 Reminders:', reminders);

    // Optionally render reminders to UI
    renderReminders(reminders); // Call a function to display reminders in the UI
  } catch (err) {
    console.error('Fetch error:', err);
    alert('❌ Failed to fetch reminders due to network/server error.');
  }
};

window.addEventListener("load", () => {
  const token = localStorage.getItem("token"); // Retrieve the token from localStorage

  if (token) {
    getReminders(); // Call the getReminders function
  } else {
    alert("You must be logged in to view reminders.");
    window.location.href = "/login"; // Redirect to login page
  }

  document.getElementById("createReminderButton").addEventListener("click", createReminder);
});
console.log("createReminder:", typeof createReminder);
