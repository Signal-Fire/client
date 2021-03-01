# Signal-Fire Client

***Signal-Fire Client** is a **WebRTC** signaling client for
[Signal-Fire Server](https://github.com/Signal-Fire/server).

## Install

The client is meant to be used with [browserify].

**Currently the client is a work-in-progres**.
Clone the repository to use the client.

## Example

**Note:**: It is assumed the server is running
[Signal-Fire Server](https://github.com/Signal-Fire/server).
The server uses a simple JSON protocol which will
soon be documented.

This example shows how to start a session.

```ts
import connect from './index'
import PeerConnection from './lib/PeerConnection'

async function createSession () {
  const client = await connect('ws://localhost:3003/socket')
  const session = await client.createSession('<target id>')

  session.on('accepted', (connection: PeerConnection) => {
    console.log('Session accepted!')
  })

  session.on('rejected', () => {
    console.log('Session rejected')
  })

  session.on('timed-out', () => {
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
  
  client.on('session', async (session: IncomingSession) => {
    const connection = session.accept()
  })
}
```
