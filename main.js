const { ipcMain } = require('electron'),
  { menubar } = require('menubar'),
  { makeRpc } = require('./utils'),
  io = require('socket.io'),
  ws = io(8080, {
    cors: {
      origin: "http://localhost:1234",
      methods: ["GET", "POST"]
    }
  }, () => console.log('io ready'))
  app = menubar({
    preloadWindow: true,
    browserWindow: {
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      }
    }
  })

app.on('ready', () => {
  console.log('app ready')
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
