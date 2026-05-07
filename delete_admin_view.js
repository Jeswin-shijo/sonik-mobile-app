const fs = require('fs');
const file = 'App.tsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = "  if (session && isAdminViewOpen && session.user.role === 'admin') {";
const endStr = "  if (session && isSettingsOpen) {";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + content.substring(endIndex);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully removed admin view block.');
} else {
  console.log('Could not find start or end string.');
}
