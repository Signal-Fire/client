'use strict'

import connect from './index'
import PeerConnection from './lib/PeerConnection'

async function run () {
  const client = await connect('ws://localhost:3003/socket')
  const session = await client.createSession('<target id>')

  session.on('accepted', async (connection: PeerConnection) => {
    console.log('Session accepted!')

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })

    stream.getTracks().forEach(track => connection.addTrack(track, stream))
  })

  session.on('rejected', () => {
    console.log('Session rejected')
  })

  session.on('timed-out', () => {
    console.log('Session timed out')
  })
}
