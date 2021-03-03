'use strict'

import EventEmitter3 from 'eventemitter3'
import PeerConnection from './PeerConnection'
import { PROTOCOL } from '../index'
import { nanoid } from 'nanoid'

import IncomingSession from './IncomingSession'
import OutgoingSession from './OutgoingSession'

export interface Message {
  id?: string,
  cmd?: string,
  ok?: boolean,
  target?: string,
  origin?: string,
  data?: {
    id?: string,
    candidate?: any,
    sdp?: any,
    message?: string,
    rtc?: RTCConfiguration
  }
}

export interface IncomingMessage extends Message {}
export interface OutgoingMessage extends Message {}

export default class Client extends EventEmitter3 {
  public readonly socket: WebSocket
  public readonly config: RTCConfiguration

  private _id: string
  private readonly connections: Map<string, PeerConnection> = new Map()
  private readonly pendingResponses: Map<string, (message: IncomingMessage) => void> = new Map()
  private readonly pendingIncomingSessions: Map<string, IncomingSession> = new Map()
  private readonly pendingOutgoingSessions: Map<string, OutgoingSession> = new Map()

  public constructor (socket: WebSocket, config: RTCConfiguration = {}) {
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
    this.config = config
  }

  public get id () {
    return this._id
  }

  public async createSession (target: string) {
    if (this.connections.has(target)) {
      throw new Error('Peer connection already established')
    } else if (this.pendingIncomingSessions.has(target) || this.pendingOutgoingSessions.has(target)) {
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

    session.once('settled', () => {
      this.pendingOutgoingSessions.delete(target)
    })

    this.pendingOutgoingSessions.set(target, session)
    return session
  }

  public createPeerConnection (target: string, config: RTCConfiguration = {}): PeerConnection {
    if (this.connections.has(target)) {
      throw new Error('Peer connection already created')
    }

    const raw = new RTCPeerConnection({ ...this.config, ...config })
    const connection = new PeerConnection(this, target, raw)

    connection.once('close', () => {
      this.connections.delete(target)
    })

    this.connections.set(target, connection)
    return connection
  }

  public async send (message: OutgoingMessage): Promise<IncomingMessage> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Socket not open')
    }

    message.id = message.id ?? nanoid()
    return new Promise<IncomingMessage>(resolve => {
      this.pendingResponses.set(message.id, resolve)
      this.socket.send(JSON.stringify(message))
    })
  }

  private handleSocketMessage (ev: MessageEvent) {
    if (typeof ev.data !== 'string') {
      this.emit('error', new Error('Expected a string'))
      return
    }

    let message: IncomingMessage

    try {
      message = JSON.parse(ev.data)
    } catch (e) {
      this.emit('error', new Error('Unable to parse message'))
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
    if (this._id) {
      this.emit('error', new Error('Already got an ID'))
      return
    }

    const id = this._id = message.data.id

    if (message.data.rtc) {
      // @ts-ignore
      this.config = {
        ...this.config,
        ...message.data.rtc
      }
    }

    this.emit('welcome', id)
  }

  private handleSessionStart (message: IncomingMessage) {
    if (!this.listenerCount('session')) {
      this.emit('error', new Error('Incoming session, but no listener(s)'))
    }

    const session = new IncomingSession(this, message.origin)

    session.once('settled', () => {
      this.pendingIncomingSessions.delete(message.origin)
    })

    this.pendingIncomingSessions.set(message.origin, session)
    this.emit('session', session)
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
      if (!this.listenerCount('incoming')) {
        this.emit('error', new Error('Incoming peer connection, but no listener(s)'))
      }

      connection = this.createPeerConnection(message.origin)
      this.emit('incoming', connection)
    }

    connection.handleMessage(message)
  }

  private handleSocketError (ev: ErrorEvent) {
    this.emit('error', ev.error)
  }

  private handleSocketClose (ev: CloseEvent) {
    this.socket.removeEventListener('message', this.handleSocketMessage)
    this.socket.removeEventListener('error', this.handleSocketError)
    this.socket.removeEventListener('close', this.handleSocketClose)
    this.emit('close', ev.code, ev.reason)
  }
}
