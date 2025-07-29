const groupSelect = document.getElementById("groupSelect");
const groupError = document.getElementById("groupError");

// Function to handle group selection
function selectGroup(group) {
  console.log(`Selected group: ${group}`);
  localStorage.setItem("selectedGroup", group);

  // 🚀 Redirect to chat page or group-specific page
  window.location.href = `/study_website.html?group=${encodeURIComponent(group)}`;
}

// Function to fetch groups from the server and render buttons
async function fetchGroups() {
  try {
    const response = await fetch("/api/groups");
    if (!response.ok) {
      throw new Error(`Failed to fetch groups: ${response.statusText}`);
    }

    const groups = await response.json();

    // Clear any existing content in the groupSelect container
    groupSelect.innerHTML = "";

    // Dynamically create buttons for each group
    if (groups.length === 0) {
      groupSelect.innerHTML = `<p class="no-groups">No groups available. Please create one!</p>`;
      return;
    }

    groups.forEach((group) => {
      const button = document.createElement("button");
      button.classList.add("group-button");
      button.textContent = group.charAt(0).toUpperCase() + group.slice(1); // Capitalize group name
      button.addEventListener("click", () => selectGroup(group));
      groupSelect.appendChild(button);
    });

    // Hide error message if groups load successfully
    groupError.style.display = "none";
  } catch (error) {
    console.error("Error fetching groups:", error);

    // Display an error message to the user
    groupError.style.display = "block";
  }
}

// Fetch groups on page load
document.addEventListener("DOMContentLoaded", fetchGroups);