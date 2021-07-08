const { ipcMain, Menu } = require('electron'),
  { menubar } = require('menubar'),
  { makeRpc } = require('./lib/utils'),
  { serve } = require('./lib/server')
  io = require('socket.io'),
  ws = io(8081, {
    cors: {
      origin: "http://localhost:1234",
      methods: ["GET", "POST"]
    }
  }, () => console.log('io ready')),
  bar = menubar({
    preloadWindow: true,
    browserWindow: {
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      }
    }
  })

bar.on('ready', () => {
  console.log('app ready')
})

// https://github.com/electron/electron/issues/23254
bar.app.commandLine.appendSwitch('webrtc-max-cpu-consumption-percentage', '100')

// https://github.com/maxogden/menubar/issues/179
bar.on('after-create-window', () => {
  const menu = Menu.buildFromTemplate([{
    label: 'exit',
    click() {
      bar.app.quit()
    }
  }])
  bar.tray.on('right-click', () => {
    bar.tray.popUpContextMenu(menu)
  })
})

ipcMain.handle('check-electron', async () => {
  return true
})
ws.on('connection', sock => {
  serve(makeRpc(sock))
})
