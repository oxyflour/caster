/**
 * 
 * @param { any } sock 
 * @returns 
 */
exports.makeRpc = function makeRpc(sock) {
  return {
    sock,
    /**
     * 
     * @param { string } evt 
     * @param  { ...any[] } args 
     * @returns { Promise<any> }
     */
    call(evt, ...args) {
      return new Promise((resolve, reject) => {
        sock.emit(evt, args, (err, ret) => err ? reject(err) : resolve(ret))
      })
    },
    /**
     * 
     * @param { string } evt 
     * @param { (...args: any[]) => Promise<any> } func 
     */
    serve(evt, func) {
      sock.on(evt, async (args, callback) => {
        try {
          const ret = await func(...args)
          callback ? callback(null, ret) : console.warn('got ' + evt, ret)
        } catch (err) {
          const { message, name, stack } = err || { }
          callback ? callback({ message, name, stack, ...err }) : console.error(err)
        }
      })
    }
  }
}
