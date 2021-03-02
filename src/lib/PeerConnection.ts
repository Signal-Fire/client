'use strict'

import EventEmitter3 from 'eventemitter3'
import Client, { IncomingMessage } from './Client'
import DataChannel from './DataChannel'

export default class PeerConnection extends EventEmitter3 {
  public readonly client: Client
  public readonly target: string
  public readonly raw: RTCPeerConnection

  private readonly dataChannels: Map<string, DataChannel> = new Map()

  public constructor (client: Client, target: string, raw: RTCPeerConnection) {
    super()
    this.client = client
    this.target = target
    this.raw = raw

    this.handleNegotiationNeeded = this.handleNegotiationNeeded.bind(this)
    this.handleIceCandidate = this.handleIceCandidate.bind(this)
    this.handleConnectionStateChange = this.handleConnectionStateChange.bind(this)
    this.handleDataChannel = this.handleDataChannel.bind(this)
    this.handleTrack = this.handleTrack.bind(this)

    raw.addEventListener('negotiationneeded', this.handleNegotiationNeeded)
    raw.addEventListener('icecandidate', this.handleIceCandidate)
    raw.addEventListener('connectionstatechange', this.handleConnectionStateChange)
    raw.addEventListener('datachannel', this.handleDataChannel)
    raw.addEventListener('track', this.handleTrack)
  }

  public addTrack (track: MediaStreamTrack, ...streams: MediaStream[]) {
    this.raw.addTrack(track, ...streams)
  }

  public createDataChannel (label: string): DataChannel {
    if (this.dataChannels.has(label)) {
      throw new Error('Data channel already created')
    }

    const raw = this.raw.createDataChannel(label)
    const channel = new DataChannel(this, raw)

    channel.once('close', () => {
      this.dataChannels.delete(label)
    })

    this.dataChannels.set(label, channel)
    return channel
  }

  public async handleMessage (message: IncomingMessage) {
    switch (message.cmd) {
      case 'ice':
        this.raw.addIceCandidate(new RTCIceCandidate(message.data.candidate))
        break
      case 'offer':
        this.raw.setRemoteDescription(message.data.sdp)
        const answer = await this.raw.createAnswer()
        this.raw.setLocalDescription(answer)
        await this.client.send({
          cmd: 'answer',
          target: message.origin,
          data: {
            sdp: this.raw.localDescription
          }
        })
        break
      case 'answer':
        this.raw.setRemoteDescription(new RTCSessionDescription(message.data.sdp))
        break
    }
  }

  private async handleIceCandidate (ev: RTCPeerConnectionIceEvent) {
    await this.client.send({
      cmd: 'ice',
      data: {
        candidate: ev.candidate
      }
    })
  }

  private async handleNegotiationNeeded () {
    const offer = await this.raw.createOffer()
    this.raw.setLocalDescription(offer)

    await this.client.send({
      cmd: 'offer',
      data: {
        sdp: this.raw.localDescription
      }
    })
  }

  private handleTrack (ev: RTCTrackEvent) {
    this.emit('track', ev.track, ev.streams)
  }

  private handleDataChannel (ev: RTCDataChannelEvent) {
    if (!this.listenerCount('data-channel')) {
      this.emit('error', new Error('Incoming data channel, but no listener(s)'))
    }

    const channel = new DataChannel(this, ev.channel)

    channel.once('close', () => {
      this.dataChannels.delete(channel.label)
    })

    this.dataChannels.set(channel.label, channel)
    this.emit('data-channel', channel)
  }

  // TODO: Add other states
  private handleConnectionStateChange () {
    switch (this.raw.connectionState) {
      case 'connected':
        this.emit('connected')
        break
      case 'closed':
        this.handleClose()
        break
      case 'failed':
        this.emit('failed')
        this.handleClose()
        break
    }
  }

  private handleClose () {
    this.raw.removeEventListener('negotiationneeded', this.handleNegotiationNeeded)
    this.raw.removeEventListener('icecandidate', this.handleIceCandidate)
    this.raw.removeEventListener('connectionstatechange', this.handleConnectionStateChange)
    this.raw.removeEventListener('datachannel', this.handleDataChannel)
    this.raw.removeEventListener('track', this.handleTrack)

    this.emit('close')
  }
}
