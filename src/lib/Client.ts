'use strict'

import { nanoid } from 'nanoid/async'

import { PROTOCOL } from '../index'
import PeerConnection from './PeerConnection'
import IncomingSession from './IncomingSession'
import OutgoingSession from './OutgoingSession'

export interface Message {
  id?: string,
  cmd?: string,
  ok?: boolean,
  origin?: string,
  target?: string,
  data?: {
    id?: string,
    candidate?: any,
    sdp?: any,
    message?: string,
    config?: {
      bundlePolicy?: RTCBundlePolicy,
      iceCandidatePoolSize?: number,
      iceServers?: RTCIceServer[],
      iceTransportPolicy?: RTCIceTransportPolicy,
      rtcpMuxPolicy?: RTCRtcpMuxPolicy
    }
  }
}

export interface IncomingMessage extends Message {}
export interface OutgoingMessage extends Message {}

export default class Client extends EventTarget {
  public readonly id: string
  public readonly configuration: RTCConfiguration

  private readonly socket: WebSocket
  private readonly connections: Map<string, PeerConnection> = new Map()
  private readonly pendingIncomingSessions: Map<string, IncomingSession> = new Map()
  private readonly pendingOutgoingSessions: Map<string, OutgoingSession> = new Map()
  private readonly pendingResponses: Map<string, (message: IncomingMessage) => void> = new Map()

  public constructor (socket: WebSocket, configuration: RTCConfiguration = {}) {
    super()

    if (socket.readyState !== WebSocket.OPEN) {
      throw new Error('Expected an open socket')
    } else if (socket.protocol !== PROTOCOL) {
      throw new Error(`Expected protocol to be ${PROTOCOL} but got ${socket.protocol ?? 'none'}`)
    }

    this.handleSocketMessage = this.handleSocketMessage.bind(this)
    this.handleSocketError = this.handleSocketError.bind(this)
    this.handleSocketClose = this.handleSocketClose.bind(this)

    socket.addEventListener('message', this.handleSocketMessage)
    socket.addEventListener('error', this.handleSocketError)
    socket.addEventListener('close', this.handleSocketClose)

    this.socket = socket
    this.configuration = configuration
  }

  public async createSession (target: string): Promise<OutgoingSession> {
    if (this.id === target) {
      throw new Error('Can\'t send a message to yourself')
    } else if (this.connections.has(target)) {
      throw new Error('Peer connection already established')
    } else if (this.pendingOutgoingSessions.has(target), this.pendingIncomingSessions.has(target)) {
      throw new Error('Session request already active')
    }

    const response = await this.send({
      cmd: 'session-start',
      target
    })

    if (!response.ok) {
      throw new Error(response.data.message)
    }

    const session = new OutgoingSession(this, target)

    session.addEventListener('settled', () => {
      this.pendingOutgoingSessions.delete(target)
    }, { once: true })

    this.pendingOutgoingSessions.set(target, session)
    return session
  }

  public createPeerConnection (target?: string, configuration?: RTCConfiguration): PeerConnection {
    if (this.id === target) {
      throw new Error('Can\'t create a connection with yourself')
    } else if (this.connections.has(target)) {
      throw new Error('Peer connection already created')
    }

    const raw = new RTCPeerConnection({ ...this.configuration, ...(configuration ?? {}) })
    const connection = new PeerConnection(this,target, raw)

    connection.addEventListener('close', () => {
      this.connections.delete(target)
    }, { once: true })

    this.connections.set(target, connection)
    return connection
  }

  public async send (message: OutgoingMessage): Promise<IncomingMessage> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Socket not open')
    } else if (message.target && message.target === this.id) {
      throw new Error('Can\'t send to yourself')
    }

    message.id = message.id ?? await nanoid()
    return new Promise<IncomingMessage>(resolve => {
      this.pendingResponses.set(message.id, resolve)
      this.socket.send(JSON.stringify(message))
    })
  }

  private handleSocketMessage (ev: MessageEvent) {
    if (typeof ev.data !== 'string') {
      this.dispatchEvent(new CustomEvent('error', {
        detail: new Error('Expected a string')
      }))

      return
    }

    let message: IncomingMessage

    try {
      message = JSON.parse(ev.data)
    } catch (e) {
      this.dispatchEvent(new CustomEvent('error', {
        detail: new Error('Unable to parse message')
      }))
      return
    }

    // Handle pending responses
    if (this.pendingResponses.has(message.id)) {
      const resolve = this.pendingResponses.get(message.id)
      this.pendingResponses.delete(message.id)
      resolve(message)
      return
    }

    switch (message.cmd) {
      case 'welcome':
        this.handleWelcome(message)
        return
      case 'session-start':
        this.handleSessionStart(message)
        return
      case 'session-accept':
      case 'session-reject':
      case 'session-cancel':
      case 'session-timeout':
        this.handleSessionUpdate(message)
        return
      case 'ice':
      case 'offer':
      case 'answer':
        this.handlePeerMessage(message)
        return
    }
  }

  private handleWelcome (message: IncomingMessage) {
    if (this.id) {
      this.dispatchEvent(new CustomEvent('error', {
        detail: new Error('Already got an ID')
      }))
      return
    }

    // @ts-ignore
    const id = this.id = message.data.id

    if (message.data.config) {
      // @ts-ignore
      this.config = {
        ...this.configuration,
        ...message.data.config
      }
    }

    this.dispatchEvent(new CustomEvent('welcome', {
      detail: id
    }))
  }

  private handleSessionStart (message: IncomingMessage) {
    const session = new IncomingSession(this, message.origin)

    session.addEventListener('settled', () => {
      this.pendingIncomingSessions.delete(message.origin)
    }, { once: true })

    this.pendingIncomingSessions.set(message.origin, session)
    this.dispatchEvent(new CustomEvent('session', {
      detail: session
    }))
  }

  private handleSessionUpdate (message: IncomingMessage) {
    // Check if we're dealing with an incoming session
    if (this.pendingIncomingSessions.has(message.origin)) {
      const session = this.pendingIncomingSessions.get(message.origin)

      switch (message.cmd) {
        case 'session-cancel':
          session.handleCancel()
          break
        case 'session-timeout':
          session.handleTimeout()
          break
      }

      return
    }

    // Check if we're dealing with an outgoing session
    if (this.pendingOutgoingSessions.has(message.origin)) {
      const session = this.pendingOutgoingSessions.get(message.origin)

      switch (message.cmd) {
        case 'session-accept':
          session.handleAccept()
          break
        case 'session-reject':
          session.handleReject()
          break
        case 'session-timeout':
          session.handleTimeout()
          break
      }
    }
  }

  private handlePeerMessage (message: IncomingMessage) {
    let connection = this.connections.get(message.origin)

    if (!connection) {
      connection = this.createPeerConnection(message.origin)
      this.dispatchEvent(new CustomEvent('incoming', {
        detail: connection
      }))
    }

    connection.handleMessage(message)
  }

  private handleSocketError (ev: ErrorEvent) {
    this.dispatchEvent(new CustomEvent('error', {
      detail: ev.error
    }))
  }

  private handleSocketClose (ev: CloseEvent) {
    this.socket.removeEventListener('message', this.handleSocketMessage)
    this.socket.removeEventListener('error', this.handleSocketError)
    this.socket.removeEventListener('close', this.handleSocketClose)

    this.dispatchEvent(new CustomEvent('close', {
      detail: {
        code: ev.code,
        reason: ev.reason
      }
    }))
  }
}
