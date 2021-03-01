'use strict'

import Client from './lib/Client'

/** The client protocol */
export const PROTOCOL = 'Signal-Fire@2'

/**
 * Connect to a Signal-Fire server instance.
 * @param url The URL of the Signal-Fire server
 * @param config WebRTC configuration
 */
export default async function connect (url: string, config?: RTCConfiguration): Promise<Client> {
  return new Promise<Client>((resolve, reject) => {
    function removeListeners () {
      socket.removeEventListener('open', onResolve)
      socket.removeEventListener('error', onReject)
      socket.removeEventListener('close', onReject)
    }

    function onResolve () {
      removeListeners()
      resolve(new Client(socket, config))
    }

    function onReject (ev?: any) {
      removeListeners()
      reject(ev?.error ?? ev ?? new Error('Unknown error'))
    }

    const socket = new WebSocket(url, PROTOCOL)
    socket.addEventListener('open', onResolve)
    socket.addEventListener('error', onReject)
    socket.addEventListener('close', onReject)
  })
}
