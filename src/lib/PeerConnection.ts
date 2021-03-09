'use strict'

import Client from './Client'
import { IncomingMessage } from './Client'

export default class PeerConnection extends EventTarget {
  public readonly client: Client
  public readonly target: string
  public readonly raw: RTCPeerConnection

  private readonly dataChannels: Map<string, RTCDataChannel> = new Map()

  public constructor (client: Client, target: string, raw: RTCPeerConnection) {
    super()
    this.client = client
    this.target = target
    this.raw = raw

    this.handleNegotiationNeeded = this.handleNegotiationNeeded.bind(this)
    this.handleIceCandidate = this.handleIceCandidate.bind(this)
    this.handleIceConnectionStateChange = this.handleIceConnectionStateChange.bind(this)
    this.handleDataChannel = this.handleDataChannel.bind(this)
    this.handleTrack = this.handleTrack.bind(this)

    raw.addEventListener('negotiationneeded', this.handleNegotiationNeeded)
    raw.addEventListener('icecandidate', this.handleIceCandidate)
    raw.addEventListener('iceconnectionstatechange', this.handleIceConnectionStateChange)
    raw.addEventListener('datachannel', this.handleDataChannel)
    raw.addEventListener('track', this.handleTrack)
  }

  public addTrack (track: MediaStreamTrack, ...streams: MediaStream[]) {
    this.raw.addTrack(track, ...streams)
  }

  public createDataChannel (label: string): RTCDataChannel {
    if (this.dataChannels.has(label)) {
      throw new Error('Data channel already created')
    }

    const channel = this.raw.createDataChannel(label)

    channel.addEventListener('close', () => {
      this.dataChannels.delete(label)
    }, { once: true })

    this.dataChannels.set(label, channel)
    return channel
  }

  public getDataChannel (label: string): RTCDataChannel {
    return this.dataChannels.get(label)
  }

  public close () {
    this.raw.close()
  }

  public async handleMessage (message: IncomingMessage): Promise<void> {
    switch (message.cmd) {
      case 'ice':
        this.raw.addIceCandidate(new RTCIceCandidate(message.data.candidate))
        break
      case 'offer':
        this.raw.setRemoteDescription(new RTCSessionDescription(message.data.sdp))
        const answer = await this.raw.createAnswer()
        this.raw.setLocalDescription(answer)
        await this.client.send({
          cmd: 'answer',
          target: this.target,
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

  private async handleIceCandidate (ev: RTCPeerConnectionIceEvent): Promise<void> {
    if (!ev.candidate) {
      return
    }

    await this.client.send({
      cmd: 'ice',
      target: this.target,
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
      target: this.target,
      data: {
        sdp: this.raw.localDescription
      }
    })
  }

  private handleTrack (ev: RTCTrackEvent) {
    this.dispatchEvent(new CustomEvent('track', {
      detail: {
        track: ev.track,
        streams: ev.streams
      }
    }))
  }

  private handleDataChannel (ev: RTCDataChannelEvent) {
    const { channel } = ev

    channel.addEventListener('close', () => {
      this.dataChannels.delete(channel.label)
    }, { once: true })

    this.dispatchEvent(new CustomEvent('data-channel', {
      detail: channel
    }))
  }

  private handleIceConnectionStateChange () {
    switch (this.raw.iceConnectionState) {
      case 'failed':
        this.dispatchEvent(new Event('failed'))
        this.handleClose()
        break
      case 'closed':
        this.handleClose()
        break
    }
  }

  private handleClose () {
    this.raw.removeEventListener('negotiationneeded', this.handleNegotiationNeeded)
    this.raw.removeEventListener('icecandidate', this.handleIceCandidate)
    this.raw.removeEventListener('iceconnectionstatechange', this.handleIceConnectionStateChange)
    this.raw.removeEventListener('datachannel', this.handleDataChannel)
    this.raw.removeEventListener('track', this.handleTrack)

    this.dispatchEvent(new Event('close'))
  }
}
