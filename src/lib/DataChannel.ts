'use strict'

import EventEmitter3 from 'eventemitter3'

import PeerConnection from './PeerConnection'

export default class DataChannel extends EventEmitter3 {
  public readonly connection: PeerConnection
  public readonly raw: RTCDataChannel

  public constructor (connection: PeerConnection, raw: RTCDataChannel) {
    super()
    this.connection = connection
    this.raw = raw

    this.handleOpen = this.handleOpen.bind(this)
    this.handleError = this.handleError.bind(this)
    this.handleMessage = this.handleMessage.bind(this)
    this.handleClose = this.handleClose.bind(this)

    // TODO: add bufferedamountlow
    raw.addEventListener('open', this.handleOpen)
    raw.addEventListener('error', this.handleError)
    raw.addEventListener('message', this.handleMessage)
    raw.addEventListener('close', this.handleClose)
  }

  public get label (): string {
    return this.raw.label
  }

  public send (data: string | Blob | ArrayBuffer | ArrayBufferView) {
    this.raw.send(<any>data)
  }

  public async close () {
    return new Promise<void>(resolve => {
      this.once('close', resolve)
      this.raw.close()
    })
  }

  private handleOpen () {
    this.emit('open')
  }

  private handleError (ev: RTCErrorEvent) {
    this.emit('error', ev.error)
  }

  private handleMessage (ev: MessageEvent) {
    this.emit('message', ev.data)
  }

  private handleClose () {
    this.raw.removeEventListener('open', this.handleOpen)
    this.raw.removeEventListener('error', this.handleError)
    this.raw.removeEventListener('message', this.handleMessage)
    this.raw.removeEventListener('close', this.handleClose)

    this.emit('close')
  }
}
