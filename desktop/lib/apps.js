// Looks for chat, AI, screen sharing and remote control apps running during a test.
const { execFile } = require("node:child_process");

const FLAGGED = [
  ["chatgpt", "ChatGPT"],
  ["claude", "Claude"],
  ["copilot", "Copilot"],
  ["gemini", "Gemini"],
  ["perplexity", "Perplexity"],
  ["cursor", "Cursor"],
  ["discord", "Discord"],
  ["slack", "Slack"],
  ["messages", "Messages"],
  ["whatsapp", "WhatsApp"],
  ["telegram", "Telegram"],
  ["signal", "Signal"],
  ["snapchat", "Snapchat"],
  ["zoom.us", "Zoom"],
  ["zoom", "Zoom"],
  ["teams", "Microsoft Teams"],
  ["facetime", "FaceTime"],
  ["teamviewer", "TeamViewer"],
  ["anydesk", "AnyDesk"],
  ["parsec", "Parsec"],
  ["rustdesk", "RustDesk"],
  ["vnc", "VNC"],
  ["obs", "OBS"],
  ["obs64", "OBS"],
  ["loom", "Loom"],
  ["screenflow", "ScreenFlow"],
];

function list() {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      execFile("tasklist", ["/fo", "csv", "/nh"], { windowsHide: true, timeout: 8000 }, (err, out) => {
        if (err) return resolve([]);
        resolve(out.split(/\r?\n/).map((l) => (l.split('","')[0] || "").replace(/^"/, "")));
      });
    } else {
      execFile("ps", ["-axco", "comm"], { timeout: 8000 }, (err, out) => resolve(err ? [] : out.split("\n").map((l) => l.trim())));
    }
  });
}

/** Display names of flagged apps that are running right now. */
async function scanApps() {
  const names = (await list()).map((n) => n.toLowerCase().replace(/\.exe$/, ""));
  const found = new Set();
  for (const n of names) {
    // Whole words only, so "obsidian" isn't "obs" and "messagesagent" isn't a chat.
    const words = n.split(/[\s._()\-]+/).filter(Boolean);
    for (const [needle, label] of FLAGGED) if (n === needle || words.includes(needle)) found.add(label);
  }
  return [...found];
}

module.exports = { scanApps, FLAGGED };
