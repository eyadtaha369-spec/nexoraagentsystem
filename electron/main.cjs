// Electron shell for Nexora CRM.
// Runs the app's own built Node server (produced by `npm run build:desktop`)
// as a local, embedded process — no external hosting, no internet needed to
// open the app. Actual CRM data still syncs with Google Apps Script when a
// connection is available; see src/services/offline for that layer.
const { app, BrowserWindow, Menu } = require("electron");
const path = require("node:path");
const { fork } = require("node:child_process");
const net = require("node:net");

const PORT = 47632; // fixed local port for the embedded server
let serverProcess = null;
let mainWindow = null;

function serverEntryPath() {
  // Packaged app: server files ship under resources/app-server (see electron-builder.json extraResources).
  // Dev: read straight from the repo's .output folder.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app-server", "server", "index.mjs");
  }
  return path.join(__dirname, "..", ".output", "server", "index.mjs");
}

function waitForPort(port, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Local server did not start in time."));
        } else {
          setTimeout(tryConnect, 150);
        }
      });
    };
    tryConnect();
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    try {
      serverProcess = fork(serverEntryPath(), [], {
        env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", ELECTRON_RUN_AS_NODE: "1" },
        stdio: "pipe",
      });
      serverProcess.stdout?.on("data", (d) => console.log(`[server] ${d}`.trim()));
      serverProcess.stderr?.on("data", (d) => console.error(`[server] ${d}`.trim()));
      serverProcess.once("error", reject);
      waitForPort(PORT).then(resolve, reject);
    } catch (e) {
      reject(e);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0b0e1a",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (e) {
    console.error("Failed to start local server:", e);
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) serverProcess.kill();
});
