const io = require('socket.io-client'),
  url = new URL(location.href),
  params = url.searchParams,
  endpoints = (params.get('endpoints') || 'ws://localhost:8080').split(';'),
  { listen, connect } = require('./lib/client'),
  { makeRpc } = require('./lib/utils')

const id = Math.random().toString(16).slice(2, 10),
  peerOpts = {
    iceServers: [{
      url: 'turn:gitlab.yff.me:3478',
      username: 'abc',
      credential: '123',
    }]
  }
document.body.style.padding = document.body.style.margin = '0'

function $el(tag, attrs = { }, children = [ ]) {
  const elem = document.createElement(tag)
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'style') {
      for (const [k, v] of Object.entries(val)) {
        elem.style[k] = v
      }
    } else {
      elem[key] = val
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      elem.appendChild(document.createTextNode(child))
    } else {
      elem.appendChild(child)
    }
  }
  return elem
}

/**
 * @type { { [endpoint: string]: { rpc: any, servers: { host: string }[] } } }
 */
let servers = { }
async function update_servers() {
  for (const item of Object.values(servers)) {
    item.servers = await item.rpc.call('add-server', id)
  }
  await show_servers()
}
async function show_servers() {
  const ui = document.querySelector('#ui')
  if (ui) {
    document.body.removeChild(ui)
  }
  document.body.appendChild($el('ul', { id: 'ui' },
    Object.entries(servers).map(([endpoint, { servers }]) => {
      return $el('li', { }, [
        $el('h1', { }, [endpoint]),
        $el('ul', { }, []),
        ...servers.map(server => $el('li', { }, [server.host]))
      ])
    })))
}

/**
 * @type { { [key: string]: { host: string, source: string, name: string, endpoints: string[] } }
 */
let clients = { }
async function show_clients(rpc, endpoint) {
  const list = await rpc.call('host-gather', 'get-sources', ['screen', 'window'])
  for (const { host, sources } of list) {
    for (const { name, source } of sources) {
      const key = host + '/' + source,
        item = clients[key] || (clients[key] = { host, source, name, endpoints: [] })
      item.endpoints.push(endpoint)
    }
  }
  const ui = document.querySelector('#ui')
  if (ui) {
    document.body.removeChild(ui)
  }
  document.body.appendChild($el('ul', { id: 'ui' },
    Object.entries(clients).map(([key, { host, source, name, endpoints }]) => {
      const href = '?' + [
        'host=' + encodeURIComponent(host),
        'source=' + encodeURIComponent(source),
        'endpoints=' + encodeURIComponent(endpoints.join(';')),
      ].join('&')
      return $el('li', { }, [
        $el('a', { href }, [`[${host}] ${name} (${source})`])
      ])
    })))
}
async function show_video(host, source, rpc) {
  const stream = await connect(host, source, rpc, peerOpts),
    video = $el('video')
  document.body.appendChild(video)
  video.srcObject = stream
  video.play()
}

for (const endpoint of endpoints) {
  const ws = io(endpoint, { transports: ["websocket"] })
  ws.on('connect', async () => {
    const rpc = makeRpc(ws)
    try {
      await require('electron').ipcRenderer.invoke('check-electron')
      document.body.classList.add('server-mode')
      servers[endpoint] = { rpc, servers: await listen(rpc, id, peerOpts) }
      await show_servers()
    } catch (err) {
      document.body.classList.add('client-mode')
      try {
        const host = params.get('host'),
          source = params.get('source')
        if (!host || !source) {
          await show_clients(rpc, endpoint)
        } else if (!window.loaded) {
          await show_video(host, source, window.loaded = rpc)
        }
      } catch (err) {
        console.error(`connect ${endpoint} failed`, err)
      }
    }
  })
  ws.on('disconnect', () => {
    delete servers[endpoint]
    for (const item of Object.values(clients)) {
      item.endpoints = item.endpoints.filter(item => item !== endpoint)
    }
  })
}

function reload_with_endpoint() {
  const text = document.getElementById('endpoint_input').value,
    endpoints = text.split('\n').join(';'),
    url = new URL(location.href)
  url.searchParams.set('endpoints', endpoints)
  location.href = url.toString()
}

document.getElementById('endpoint_input').value = endpoints.join('\n')
document.getElementById('apply_config').onclick = reload_with_endpoint
document.getElementById('update_servers').onclick = update_servers
