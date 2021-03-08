# Documentation

* [Install](#Install)
* [Connecting to the Server](#Connecting-to-the-Server)
* [Starting a Session](#Starting-a-Session)
* [Accepting or Rejecting a Session](#Accepting-or-rejecting-a-Session)
* [Media Setup](#Media-Setup)
* [Data Channels](#Data-Channels)

## Install

The Client can be installed through npm:

```
> npm i @signal-fire/client [--save]
```

The Client has been designed to be used with [browserify](http://browserify.org).

## Connecting to the Server

> We assume here the server is running [Signal Fire Server](https://github.com/Signal-Fire/server).
> The Server uses a simple JSON-based protocol which is documented
> [here](https://github.com/Signal-Fire/server/blob/main/PROTOCOL.md).

The Client exports a simple `connect` function.
The function takes care of setting up the WebSocket
connection to the Server.

```typescript
import connect from '@signal-fire/client'

connect('ws://localhost/socket')
  .then(client => /* do something with the client */)
  .catch(err => console.error(err))
```

That's all there is to it!

## Starting a Session

Sessions represent requests and responses concerning
setting up peer connections between Clients.

To start a session, all you have to do is send a
session request to the target client ID. The target
Client then has the option of accepting or rejecting
the session request.

> Methods of exhanging IDs is currently outside the scope
> of both the Client and Server. However, the Server can be
> extended to include this functionality.

```typescript
import { PeerConnection } from '@signal-fire/client'

// Create a new session request for the target ID
const session = await client.createSession('<target id>')

// The target has accepted the request
session.addEventListener('accepted', (ev: CustomEvent<PeerConnection>) => {
  console.log('Session accepted')

  // Access the connection through the `detail` property
  const connection = ev.detail

  // at this point you can start adding media
  // or opening data channels
})

// The target had rejected the request
session.addEventListener('rejected', (ev: CustomEvent<string>) => {
  console.log(`Session rejected with reason ${ev.detail ?? 'none'}`)
})

// The session request timed out
session.addEventListener('timed-out', () => {
  console.log('Session timed out')
})
```

## Accepting or Rejecting a Session

```typescript
import { IncomingSession } from '@signal-fire/client'

// We have an incoming session request
client.addEventListener('session', async (ev: CustomEvent<IncomingSession>) => {
  // Accept the session request...
  const connection = await session.accept()

  // or reject it
  await session.reject('I don\'t like you.')
})
```

## Media Setup

```typescript
// We got our connection from somehwere
const connection: PeerConnection

// Get user media
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
})

// Add each track to the connection
stream.getTracks().forEach(track => connection.addTrack(track, stream))

// listen for incoming tracks
connection.addEventListener('track', (ev: CustomEvent< track: MediaStreamTrack, streams: MediaStream[] >)) {
  // we have received a track from the remote peer
}
```

## Data Channels

Data Channels can be used to send arbitrary
data between peers.

Creating one is easy:

```typescript
const channel = connection.createDataChannel('label')

// `channel` is a regulat RTCDataChannel without spice
```

Listen for data channels created by the other peer:

```typescript
connection.addEventListener('data-channel', (ev: CustomEvent<RTCDataChannel>) => {
  // do something with the data channel...
})
```
