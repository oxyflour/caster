const { ipcMain, Menu } = require('electron'),
  { menubar } = require('menubar'),
  { makeRpc } = require('./utils'),
  io = require('socket.io'),
  ws = io(8080, {
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

/**
 * @type { any[] }
 */
let servers = []
ipcMain.handle('check-electron', async () => {
  return true
})
ws.on('connection', sock => {
  const rpc = makeRpc(sock)
  rpc.host = Math.random().toString(16).slice(2, 10)
  rpc.serve('add-server', async () => {
    console.log('add server', rpc.host)
    servers = Array.from(new Set(servers.concat([rpc])))
    return servers.map(({ host }) => ({ host }))
  })
  rpc.serve('host-gather', async (event, ...args) => {
    return await Promise.all(servers.map(async rpc => ({
      host: rpc.host,
      sources: await rpc.call(event, ...args),
    })))
  })
  rpc.serve('host-proxy', async (host, event, ...args) => {
    const rpc = servers.find(item => item.host === host)
    if (rpc) {
      return await rpc.call(event, ...args)
    } else {
      throw Error(`no such host ${host}`)
    }
  })
  sock.on('disconnect', () => {
    servers = servers.filter(item => item !== rpc)
  })
})
