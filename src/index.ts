'use strict'

import adapter from 'webrtc-adapter'
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

export { default as Client, Message, IncomingMessage, OutgoingMessage } from './lib/Client'
export { default as PeerConnection } from './lib/PeerConnection'
export { default as IncomingSession } from './lib/IncomingSession'
export { default as OutgoingSession } from './lib/OutgoingSession'

// Hack to make sure the adapter import is not removed
// by the TypeScript compiler
export const browserVersion = adapter.browserDetails.version
