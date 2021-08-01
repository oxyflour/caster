const React = require('react'),
  { useEffect, useState, useRef } = require('react'),
  { makeRpc } = require('caster-stream/lib/utils'),
  ReactDOM = require('react-dom'),
  { io } = require('socket.io-client'),
  client = require('caster-stream/lib/client')

const
  peerOpts = {
    iceServers: [{
      urls: 'stun:stun.gmx.net'
    }]
  }

function useAsync(func, deps = undefined, init = undefined) {
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(null),
    [value, setValue] = useState(init)
  async function runAsync({ canceled }) {
    setLoading(true)
    setError(null)
    try {
      const value = await func()
      canceled || setValue(value)
    } catch (err) {
      canceled || setError(err)
    }
    canceled || setLoading(false)
  }
  useEffect(() => {
    const status = { canceled: false }
    runAsync(status)
    return () => { status.canceled = true }
  }, deps)
  return [{ loading, error, value }, () => runAsync({ })]
}

function Center({ children }) {
  return <div style={{
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}>{ children }</div>
}

function Main() {
  const [rpc, setRpc] = useState(null)
  useEffect(() => {
    const ws = io('ws://localhost:8080', { transports: ['websocket'] })
    ws.on('connect', () => setRpc(makeRpc(ws)))
    ws.on('disconnect', () => setRpc(null))
    return () => ws.disconnect()
  }, [])
  return !rpc ?
    <Center>Connection...</Center> :
    <List rpc={ rpc } />
}

/**
 * 
 * @param { { rpc: any } } props 
 * @returns 
 */
function List({ rpc }) {
  const [list] = useAsync(
    () => rpc.call('host-gather', 'get-sources', ['screen', 'window']),
    [rpc], [])
  const [selected, setSelected] = useState(null),
    [hoverOnToolbar, setHoverOnToolbar] = useState(false)
  return list.loading ?
    <Center>Listing...</Center> :
  list.error ?
    <Center>{ 'ERR: ' + list.error }</Center> :
  selected ?
    <>
      <div style={{
        zIndex: 10,
        position: 'absolute',
        background: '#3f3f3f',
        width: '100%',
        overflow: 'hidden',
        height: hoverOnToolbar ? 'auto' : 5,
      }}
        onMouseOver={ () => setHoverOnToolbar(true) }
        onMouseOut={ () => setHoverOnToolbar(false) }>
        <div style={{ margin: 8 }}>
          <button onClick={ () => setSelected(null) }>back</button>
        </div>
      </div>
      <Cast rpc={ rpc } { ...selected } />
    </> :
    <div>
    {
      list.value.map(({ host, sources }) => <div key={ host }>
        <h1>Host { host }</h1>
        <ul>
        {
          sources.map(({ source, name }) => <li key={ source }>
            <a href="#" onClick={ () => setSelected({ host, source }) }>
              { name } ({ source })
            </a>
          </li>)
        }
        </ul>
      </div>)
    }
    </div>
}

/**
 * 
 * @param { { source: string, host: string, rpc: any } } props 
 */
function Cast({ rpc, host, source }) {
  const [stream] = useAsync(() => {
      return client.connect(host, source, rpc, peerOpts, {
        minWidth: window.innerWidth,
        maxWidth: window.innerWidth,
        minHeight: window.innerHeight,
        maxHeight: window.innerHeight,
      })
    }, [host, source]),
    videoRef = useRef(null)
  useEffect(() => {
    const [video, media] = [videoRef.current, stream.value]
    if (video && media && video.srcObject !== media) {
      video.srcObject = media
      video.play()
    }
  }, [stream, videoRef])
  return stream.loading ?
    <Center>Loading { source } from { host }</Center> :
  stream.error ?
    <Center>Load { source } from { host } Failed ({ 'ERR: ' + stream.error })</Center> :
  <video ref={ videoRef }></video>
}

let root = document.getElementById('root')
if (!root) {
  const root = document.createElement('div')
  root.style.width = root.style.height = '100%'
  document.body.appendChild(root)
}
ReactDOM.render(<Main />, root)
