const React = require('react'),
  { useEffect, useState, useRef } = require('react'),
  { makeRpc } = require('caster-stream/lib/utils'),
  ReactDOM = require('react-dom'),
  { io } = require('socket.io-client'),
  client = require('caster-stream/lib/client')

const
  peerOpts = {
    iceServers: [{
      url: 'turn:gitlab.yff.me:3478',
      username: 'abc',
      credential: '123',
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

function Center({ style = { }, children }) {
  return <div style={{
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style
  }}>{ children }</div>
}

function Main() {
  const [rpc, setRpc] = useState(null)
  useEffect(() => {
    const ws = io('ws://pc10.yff.me:8080', { transports: ['websocket'] })
    ws.on('connect', () => setRpc(makeRpc(ws)))
    ws.on('disconnect', () => setRpc(null))
    return () => ws.disconnect()
  }, [])
  return !rpc ?
    <Center>Connection...</Center> :
    <List rpc={ rpc } />
}

const imageStyle = `
.sources .img {
  float: left;
  clear: right;
  cursor: pointer;
  padding: 4px;
  margin: 4px;
  width: 150px;
  height: 100px;
  object-fit: contain;
}
.sources .img:hover {
  background: #ccc;
}
`

function Sources({ list, onClick }) {
  return <>
  <style>{ imageStyle }</style>
  {
    list.value.map(({ host, sources }) => <div key={ host } className="sources">
      <p>Host { host }</p>
      {
        sources.map(({ source, name, thumbnail }) => <img
          className="img"
          title={ name }
          src={ thumbnail }
          onClick={ () => onClick({ host, source }) }
          key={ source } />)
      }
    </div>)
  }
  </>
}

const siderStyle = `
.sider {
  z-index: 10;
  position: absolute;
  background: rgba(255, 255, 255, 0.8);
  overflow-x: hidden;
  height: 100%;
}
.sider .sources .img {
  float: none;
}
`

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
      <style>{ siderStyle }</style>
      <div className="sider" style={{ width: hoverOnToolbar ? 'auto' : 5 }}
        onMouseOver={ () => setHoverOnToolbar(true) }
        onMouseOut={ () => setHoverOnToolbar(false) }>
        <div style={{ width: 170 }}>
          <Sources list={ list } onClick={ setSelected } />
        </div>
      </div>
      <Cast rpc={ rpc } { ...selected } />
    </> :
    <Sources list={ list } onClick={ setSelected } />
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
