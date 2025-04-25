const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: __dirname + '/assets/icon.ico',
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile("index.html");
  // win.webContents.openDevTools();
}

ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (result.canceled) return [];
  const files = fs
    .readdirSync(result.filePaths[0])
    .filter((f) => f.endsWith(".geojson"))
    .map((f) => path.join(result.filePaths[0], f));
  return files;
});

app.whenReady().then(createWindow);
