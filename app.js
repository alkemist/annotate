const {app, BrowserWindow, ipcMain} = require('electron')
const url = require("url");
const path = require("path");
const fs = require("fs");


let win

function isDev() {
  console.log(process.argv)
  return process.argv[2] === '--dev';
}

function createWindow() {
  win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  })

  win.fs = require('fs')

  // For dev
  if (isDev()) {
    win.loadURL(
      url.format({
        pathname: 'localhost:4200',
        protocol: 'http:',
        slashes: true
      })
    );
  } else {
    // For build
    win.loadURL(
      url.format({
        pathname: path.join(__dirname, `/dist/annotate/browser/index.html`),
        protocol: "file:",
        slashes: true
      })
    );
  }

  // Open the DevTools.
  // win.webContents.openDevTools()

  win.on('closed', function () {
    win = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  if (win === null) createWindow()
})

ipcMain.on("askToRead", (event, filePath) => {
  console.log('askToRead', filePath)

  const ext = filePath.split('.').at(-1);
  fs.readFile(
    filePath,
    {encoding: ['txt', 'labels', 'last'].includes(ext) ? 'utf-8' : 'base64'},
    (error, data) => {
      win.webContents.send("sendReadContent", filePath, data);
    }
  )
})

ipcMain.on("askToWrite", (event, filePath, content) => {
  console.log('askToWrite', filePath)

  fs.writeFile(filePath, content, () => {
    win.webContents.send("sendWriteEnd", filePath);
  });
})
