'use strict'

import EventEmitter3 from 'eventemitter3'

import Client from './Client'
import PeerConnection from './PeerConnection'

export default class IncomingSession extends EventEmitter3 {
  public readonly client: Client
  public readonly origin: string

  private settled = false

  public constructor (client: Client, origin: string) {
    super()
    this.client = client
    this.origin = origin
  }

  public async accept (): Promise<PeerConnection> {
    if (this.settled) {
      throw new Error('Request already settled')
    }

    const response = await this.client.send({
      cmd: 'session-accept',
      target: this.origin
    })

    if (!response.ok) {
      const err = new Error(response.data.message)
      this.settle('error', err)
      throw err
    }

    return new Promise<PeerConnection>(resolve => {
      const onIncoming = (connection: PeerConnection) => {
        if (connection.target === this.origin) {
          this.client.removeListener('incoming', onIncoming)
          resolve(connection)
        }
      }

      this.client.on('incoming', onIncoming)
    })
  }

  public async reject (reason?: string): Promise<void> {
    if (this.settled) {
      throw new Error('Request already settled')
    }

    const response = await this.client.send({
      cmd: 'session-reject',
      target: this.origin
    })

    if (!response.ok) {
      const err = new Error(response.data.message)
      this.settle('error', err)
      throw err
    }
  }

  public handleCancel () {
    this.settle('canceled')
  }

  public handleTimeout () {
    this.settle('timed-out')
  }

  private settle (type: string, arg?: any) {
    if (this.settled) {
      return
    }

    this.settled = true
    this.emit(type, arg)
    this.emit('settled')
  }
}
