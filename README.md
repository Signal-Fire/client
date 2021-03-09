# Signal-Fire Client

**Signal-Fire Client** is a **WebRTC** signaling client for
[Signal-Fire Server](https://github.com/Signal-Fire/server).

A WebRTC signaling server communicates between peers to set up
peer-to-peer audio/video and/or data channels. This allows your
clients to communicate directly with each other.

## Features

* Works __seamlessly__ with [Signal-Fire Server](https://github.com/Signal-Fire/server)
* __Abstracts away__ the hassles of setting up peer connections
* Includes [webrtc-adapter](https://github.com/webrtchacks/adapter) for browser compatibility
* Uses a __simple__, JSON-based [protocol](https://github.com/Signal-Fire/server/blob/main/PROTOCOL.md)
* __No__ forest of dependencies

## Install

Install using npm:

```
npm i @signal-fire/client
```

The Client is designed to be used with [browserify](http://browserify.org).

## Documentation

[Click here to view the documentation](https://signal-fire.github.io/client/).

## Example

> __Note__: Is is assumed the server is running
> [Signal Fire Server](https://github.com/Signal-Fire/server)
> or a server which uses the same [protocol](https://github.com/Signal-Fire/server/blob/main/PROTOCOL.md).

> See the documentation for more examples!

This example shows how to start a session.

```ts
import connect, { SessionAcceptedEvent } from '@signal-fire/client'

async function run () {
  const client = await connect('ws://localhost:3003/socket')
  const session = await client.createSession('<target id>')

  session.addEventListener('accepted', (ev: SessionAcceptedEvent) => {
    console.log('Session accepted!')

    const connection = ev.detail
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })

    stream.getTracks().forEach(track => {
      connection.addTrack(track, stream)
    })
  })

  session.addEventListener('rejected', () => {
    console.log('Session rejected')
  })

  session.addEventListener('timed-out', () => {
    console.log('Session timed out')
  })
}
```

This example shows how to accept a session.

```ts
import connect, { IncomingSessionEvent } from '@signal-fire/client'

async function run () {
  const client = await connect('ws://localhost:3003/socket')

  client.addEventListener('session', (ev: IncomingSessionEvent) => {
    const session = ev.detail
    const connection = await session.accept()
  })
}
```
