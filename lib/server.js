/**
 * @type { any[] }
 */
let servers = []

function serve(rpc, sock) {
  rpc.serve('add-server', async host => {
    console.log('add server', rpc.host = host)
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
}

module.exports = { serve }
