const io = require('socket.io-client'),
  url = new URL(location.href),
  params = url.searchParams,
  ws = io(params.get('endpoint') || 'ws://localhost:8080', { transports: ["websocket"] }),
  { makeRpc } = require('./utils'),
  rpc = makeRpc(ws)

document.body.style.padding = document.body.style.margin = '0'

const peerOpts = {
  /*
  iceServers: [
    {url:'stun:stun.xten.com'},
  ]
   */
}

function $el(tag, attrs = { }, children = [ ]) {
  const elem = document.createElement(tag)
  for (const [key, val] of Object.entries(attrs)) {
    elem[key] = val
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

rpc.serve('get-sources', async types => {
  const { desktopCapturer } = require('electron'),
    sources = await desktopCapturer.getSources({ types })
  return sources.map(({ id, name, thumbnail }) => ({
    id,
    name,
    thumbnail: thumbnail.toDataURL()
  }))
})

/**
 * @type { Record<string, RTCPeerConnection> }
 */
const peers = window.peers = { }

rpc.serve('ask-stream', async ({ peerId: remoteId, host, constrain }) => {
  const peerId = Math.random().toString(16).slice(2, 10),
    conn = peers[peerId] = new RTCPeerConnection(peerOpts)
  conn.addEventListener('icecandidate', evt => {
    evt.candidate && rpc.call('host-proxy', host, 'ice-candidate', { peerId: remoteId, candidate: evt.candidate })
  })
  const stream = await navigator.mediaDevices.getUserMedia(constrain)
  for (const track of stream.getTracks()) {
    conn.addTrack(track)
  }
  const offer = await conn.createOffer()
  await conn.setLocalDescription(offer)
  return { peerId, offer }
})

rpc.serve('answer-stream', async ({ peerId, answer }) => {
  const conn = peers[peerId]
  if (!conn) return
  await conn.setRemoteDescription(new RTCSessionDescription(answer))
})

rpc.serve('ice-candidate', async ({ peerId, candidate }) => {
  const conn = peers[peerId]
  if (!conn) return
  conn.addIceCandidate(new RTCIceCandidate(candidate))
})

async function show_server() {
  await require('electron').ipcRenderer.invoke('check-electron')
  const servers = await rpc.call('add-server')
  document.body.appendChild($el('ul', { }, servers.map(({ host }) => $el('li', { }, [host]))))
}

async function show_sources() {
  const ret = await rpc.call('host-gather', 'get-sources', ['screen', 'window'])
  for (const { host, sources } of ret) {
    document.body.appendChild($el('div', { }, [
      $el('h1', { }, [`Host ${host}`]),
      $el('ul', { }, sources.map(({ name, id: source }) => $el('li', { }, [
        $el('a', {
          href: '?source=' + encodeURIComponent(JSON.stringify({ source, host })),
        }, [
          `${name} (${source})`
        ])
      ])))
    ]))
  }
}

async function show_video({ source, host }) {
  const peerId = Math.random().toString(16).slice(2, 10),
    conn = peers[peerId] = new RTCPeerConnection(peerOpts)
  conn.addEventListener('icecandidate', evt => {
    evt.candidate && rpc.call('host-proxy', host, 'ice-candidate', { peerId: remoteId, candidate: evt.candidate })
  })
  conn.addEventListener('track', evt => {
    const video = $el('video')
    document.body.appendChild(video)
    const [stream] = evt.streams
    if (stream) {
      video.srcObject = stream
    } else if (evt.track) {
      const stream = video.srcObject = new MediaStream()
      stream.addTrack(evt.track)
    }
    video.play()
  })
  const constrain = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source,
        minWidth: 1280,
        maxWidth: 1280,
        minHeight: 720,
        maxHeight: 720
      }
    }
  }
  const { peerId: remoteId, offer } = await rpc.call('host-proxy', host, 'ask-stream', { peerId, host, constrain })
  await conn.setRemoteDescription(new RTCSessionDescription(offer))
  const answer = await conn.createAnswer()
  await conn.setLocalDescription(answer)
  await rpc.call('host-proxy', host, 'answer-stream', { peerId: remoteId, answer })
}

async function bootstrap() {
  try {
    await show_server()
  } catch (err) {
    console.warn('seems not running inside electron', err)
    try {
      const source = params.get('source')
      if (!source) {
        await show_sources()
      } else {
        await show_video(JSON.parse(source))
      }
    } catch (err) {
      console.error('connect', err)
    }
  }
}

ws.on('connect', bootstrap)

/*
async function start() {
  const { desktopCapturer } = require('electron'),
    sources = await desktopCapturer.getSources({ types: ['screen', 'window'] }),
    source = sources.find(source => source.name.includes('node.js'))
  console.log(sources)
  if (source) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
          minWidth: 1280,
          maxWidth: 1280,
          minHeight: 720,
          maxHeight: 720
        }
      }
    })
    const video = $el('video')
    video.srcObject = stream
    document.body.appendChild(video)
    video.play()
  }
}
start()
 */
