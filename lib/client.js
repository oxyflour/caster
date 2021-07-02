/**
 * @type { Record<string, RTCPeerConnection> }
 */
const peers = { }

async function serve(rpc, host, peerOpts = { }) {
  rpc.serve('get-sources', async types => {
    const { desktopCapturer } = require('electron'),
      sources = await desktopCapturer.getSources({ types })
    return sources.map(({ id, name, thumbnail }) => ({
      source: id,
      name,
      thumbnail: thumbnail.toDataURL()
    }))
  })

  rpc.serve('ask-stream', async ({ peerId: remoteId, host, constrain }) => {
    const peerId = Math.random().toString(16).slice(2, 10),
      conn = peers[peerId] = new RTCPeerConnection(peerOpts)
    conn.addEventListener('icecandidate', evt => {
      evt.candidate && rpc.call('host-proxy', host, 'ice-candidate', { peerId: remoteId, candidate: evt.candidate })
    })
    conn.addEventListener('connectionstatechange', function onConnectionStateChange() {
      if (conn.connectionState === 'disconnected') {
        conn.removeEventListener('connectionstatechange', onConnectionStateChange)
        for (const track of stream.getTracks()) {
          track.stop()
        }
      }
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

  return await rpc.call('add-server', host)
}

async function connect(host, source, rpc, peerOpts = { }) {
  const peerId = Math.random().toString(16).slice(2, 10),
    conn = peers[peerId] = new RTCPeerConnection(peerOpts)
  conn.addEventListener('icecandidate', evt => {
    evt.candidate && rpc.call('host-proxy', host, 'ice-candidate', { peerId: remoteId, candidate: evt.candidate })
  })
  const promise = new Promise(resolve => {
    conn.addEventListener('track', function onTrack(evt) {
      conn.removeEventListener('track', onTrack)
      const [stream] = evt.streams
      if (stream) {
        resolve(stream)
      } else if (evt.track) {
        const stream = new MediaStream()
        stream.addTrack(evt.track)
        resolve(stream)
      }
    })
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
  return promise
}

module.exports = { serve, connect }
