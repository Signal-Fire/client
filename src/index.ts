'use strict'

import adapter from 'webrtc-adapter'
import Client, { IncomingMessage } from './lib/Client'

/** The client protocol */
export const PROTOCOL = 'Signal-Fire@2'

/**
 * Connect to a Signal-Fire server instance.
 * @param url The URL of the Signal-Fire server
 * @param configuration WebRTC configuration
 */
export default async function connect (url: string, configuration?: RTCConfiguration): Promise<Client> {
  return new Promise<Client>((resolve, reject) => {
    function removeListeners () {
      socket.removeEventListener('open', onOpen)
      socket.removeEventListener('message', onMessage)
      socket.removeEventListener('error', onError)
      socket.removeEventListener('close', onClose)
    }

    function onOpen () {
      if (socket.protocol !== PROTOCOL) {
        removeListeners()
        socket.close(1002)
        reject(new Error(`Expected protocol to be ${PROTOCOL} but got ${socket.protocol ?? 'none'}`))
      }
    }

    function onMessage (ev: MessageEvent<string>) {
      if (typeof ev.data !== 'string') {
        removeListeners()
        socket.close(1003)
        reject(new Error('Expected a string'))
        return
      }

      let message: IncomingMessage

      try {
        message = JSON.parse(ev.data)
      } catch (e) {
        removeListeners()
        socket.close(1003)
        reject(new Error('Unable to parse message'))
        return
      }

      if (message.cmd !== 'welcome') {
        removeListeners()
        socket.close(1008)
        reject(new Error('Expected \'welcome\' message'))
        return
      } else if (!message.data.id) {
        removeListeners()
        socket.close(1008)
        reject(new Error('Missing Client ID'))
        return
      }

      removeListeners()
      resolve(new Client(message.data.id, socket, configuration))
    }

    function onError (ev: ErrorEvent) {
      removeListeners()
      reject(ev.error)
    }

    function onClose (ev: CloseEvent) {
      removeListeners()
      reject(new Error(`Socket closed with code ${ev.code} (${ev.reason ?? 'no reason'})`))
    }

    const socket = new WebSocket(url, PROTOCOL)
    socket.addEventListener('open', onOpen)
    socket.addEventListener('message', onMessage)
    socket.addEventListener('error', onError)
    socket.addEventListener('close', onClose)
  })
}

export { default as Client, Message, OutgoingMessage, IncomingMessage } from './lib/Client'
export { default as PeerConnection } from './lib/PeerConnection'
export { default as IncomingSession } from './lib/IncomingSession'
export { default as OutgoingSession } from './lib/OutgoingSession'

// Hack to make sure the adapter import is not removed
// by the TypeScript compiler
export const browserVersion = adapter.browserDetails.version
