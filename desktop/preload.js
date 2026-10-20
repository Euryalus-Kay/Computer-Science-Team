// The bridge the website uses to talk to the app. Kept tiny on purpose.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("labcsDesktop", {
  version: ipcRenderer.sendSync("labcs:version"),
  /** Subscribe to app events (window focus, displays, clipboard, apps). Returns an unsubscribe function. */
  on(cb) {
    const handler = (_e, event) => cb(event);
    ipcRenderer.on("labcs:event", handler);
    return () => ipcRenderer.removeListener("labcs:event", handler);
  },
  testStarted: (info) => ipcRenderer.send("labcs:test-started", info),
  testEnded: () => ipcRenderer.send("labcs:test-ended"),
  quit: () => ipcRenderer.send("labcs:quit"),
  info: () => ipcRenderer.invoke("labcs:info"),
  openSite: () => ipcRenderer.invoke("labcs:open-site"),
  setServer: (url) => ipcRenderer.invoke("labcs:set-server", url),
  exitCode: (code) => ipcRenderer.invoke("labcs:exit-code", code),
  exitCancel: () => ipcRenderer.send("labcs:exit-cancel"),
});
