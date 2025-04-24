const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs");

contextBridge.exposeInMainWorld("api", {
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
  readFile: (filePath) => fs.readFileSync(filePath, "utf-8"),
});
