'use strict'

import EventEmitter3 from 'eventemitter3'
import Client, { OutgoingMessage } from './Client'

export default class OutgoingSession extends EventEmitter3 {
  public readonly client: Client
  public readonly target: string

  private settled = false

  public constructor (client: Client, target: string) {
    super()
    this.client = client
    this.target = target
  }

  public async cancel (reason?: string): Promise<void> {
    if (this.settled) {
      throw new Error('Request settled')
    }

    const request: OutgoingMessage = {
      cmd: 'session-cancel',
      target: this.target
    }

    if (reason) {
      request.data = {
        message: reason
      }
    }

    const response = await this.client.send(request)

    if (!response.ok) {
      const err = new Error(response.data.message)
      this.settle('error', err)
      throw err
    }

    this.settle('canceled')
  }

  public handleAccept () {
    if (this.settled) {
      throw new Error('Request settled')
    }

    const connection = this.client.createPeerConnection(this.target)
    this.settle('accepted', connection)
  }

  public handleReject () {
    this.settle('rejected')
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
