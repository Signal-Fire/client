# Signal-Fire Client

**Signal-Fire Client** is a **WebRTC** signaling client for
[Signal-Fire Server](https://github.com/Signal-Fire/server).

## Install

The client is meant to be used with [browserify](http://browserify.org).

Install using npm:

```
npm i @signal-fire/client
```

## Example

**Note:**: It is assumed the server is running
[Signal-Fire Server](https://github.com/Signal-Fire/server).
The server uses a simple JSON protocol which will
soon be documented.

This example shows how to start a session.

```ts
import connect from './index'
import PeerConnection from './lib/PeerConnection'

async function run () {
  const client = await connect('ws://localhost:3003/socket')
  const session = await client.createSession('<target id>')

  session.addEventListener('accepted', (ev: CustomEvent<PeerConnection>) => {
    console.log('Session accepted!')

    const connection = ev.detail
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })

    stream.getTracks().forEach(track => connection.addTrack(track, stream))
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
import connect from './index'
import IncomingSession from './lib/IncomingSession'

async function run () {
  const client = await connect('ws://localhost:3003/socket')

  client.addEventListener('session', (ev: CustomEvent<IncomingSession>) => {
    const session = ev.detail
    const connection = await session.accept()
  })
}
```
