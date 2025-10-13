// study-groups.js
const groups = ["BTech", "MTech", "PhD"];

function getAllGroups() {
  return groups;
}

function isValidGroup(name) {
  return groups.includes(name);
}

module.exports = {
  getAllGroups,
  isValidGroup,
};
