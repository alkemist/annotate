const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld(
  "api", {
    send: (channel, ...args) => {
      // whitelist channels
      let validChannels = ["askToRead", "askToWrite", "askToRemove"];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      } else {
        throw "invalid channel"
      }
    },
    receive: (channel, func) => {
      let validChannels = ["sendReadContent", "sendWriteEnd", "sendRemoveEnd"];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      } else {
        throw "invalid channel"
      }
    }
  }
)
