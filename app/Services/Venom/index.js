const venom = require('venom-bot');
const fs = require('fs');
const fsAsync = require('fs/promises')

module.exports = new class {
  constructor() {
    this.connections = []
  }

  async getExistingConnections() {
    const sessions = await fsAsync.readdir('tokens')

    return sessions.map(s => s.replace('-session', ''))
  }

  getConnectionNames() {
    if (this.connections.length) {
      return this.connections.map(c => c.connectionName)
    }

    return [];
  }

  async createIfNotConnected(connectionName) {
    const isConnectedAlready = this.getConnectionNames().includes(connectionName);
    
    console.log({
      connectionName,
      isConnectedAlready,
    });

    if (!isConnectedAlready) {
      return await this.makeConnection(connectionName)
    }
  }

  async getConnection(connectionName) {
    if (typeof connectionName != 'undefined') {
      const results = await this.createIfNotConnected(connectionName);

      if (results) {
        return results
      }

      return this.connections.filter(c => c.connectionName == connectionName)[0];
    }

    return this.connections
  }

  async makeConnection(connectionName) {
    return new Promise((resolve, reject) => {
      const catchQR = (base64Qr) => {
        const matches = base64Qr.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        const response = {};

        if (matches.length !== 3) {
          return new Error('Invalid input string');
        }

        response.type = matches[1];

        response.data = new Buffer.from(matches[2], 'base64');

        const imageBuffer = response;

        const fileName = `${connectionName}-qr.png`

        const path = `public/storage/${fileName}`

        fs.writeFile(path, imageBuffer['data'], 'binary', (err) => {
          if (err != null) {
            console.log(err);
          }
        });

        resolve({
          connectionName,
          status: "WAITING_FOR_QRSCAN",
          url: process.env.APP_URL + `/render/qr/${fileName}`,
        })
      }

      const options = {
        session: `${connectionName}-session`,
        disableSpins: true,
        disableWelcome: true,
        useChrome: false,
      }

      venom.create(options, catchQR)
        .then(client => {
          const connection = {
            connectionName,
            client,
            status: 'CONNECTED'
          }

          this.connections.push(connection)

          resolve(connection)
        })
        .catch(err => reject(err))
    })
  }

  async sendMessage({ connectionName, number, message }) {
    return new Promise( async (resolve, reject) => {
      const connection = await this.getConnection(connectionName)

      if (connection) {
        const client = connection.client
  
        if (typeof number == 'undefined' || typeof message == 'undefined') {
          reject('Missing Params');
        }
  
        try {
          const response = await client.sendText(`${number}@c.us`, message)
  
          resolve(response)
        } catch (error) {
          reject(error)
        }
      }
    })
  }
}