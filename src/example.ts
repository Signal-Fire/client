'use strict'

import connect from './index'
import PeerConnection from './lib/PeerConnection'

async function run () {
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
