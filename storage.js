const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data.json');

let data = { guilds: {} };

function load() {
  try {
    if (fs.existsSync(FILE)) {
      data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load data.json:', err.message);
  }
}

function save() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save data.json:', err.message);
  }
}

function guild(guildId) {
  if (!data.guilds[guildId]) data.guilds[guildId] = {};
  return data.guilds[guildId];
}

module.exports = { load, save, guild };
