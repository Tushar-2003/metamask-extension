const ganache = require('ganache');

const defaultOptions = {
  blockTime: 2,
  network_id: 1337,
  mnemonic:
    'phrase upgrade clock rough situate wedding elder clever doctor stamp excess tent',
  port: 8545,
  vmErrorsOnRPCResponse: false,
  hardfork: 'muirGlacier',
  quiet: true,
};

// This is a "static" variable that holds the default Ganache instance
let ganacheInstanceOnDefaultPort = null;

class Ganache {
  async start(opts) {
    const options = { ...defaultOptions, ...opts };
    const { port } = options;

    this._server = ganache.server(options);

    try {
      await this._server.listen(port);
    } catch (e) {
      console.log('Caught error starting Ganache server', e);

      if (ganacheInstanceOnDefaultPort) {
        console.log('Closing old Ganache instance and restarting');
        ganacheInstanceOnDefaultPort.quit();
        await this._server.listen(port);
      }
    }

    // Set the "static" variable
    if (port === defaultOptions.port) {
      ganacheInstanceOnDefaultPort = this; // eslint-disable-line consistent-this
    }
  }

  getProvider() {
    return this._server.provider;
  }

  async getAccounts() {
    return await this.getProvider().request({
      method: 'eth_accounts',
      params: [],
    });
  }

  async getBalance() {
    const accounts = await this.getAccounts();
    const balanceHex = await this.getProvider().request({
      method: 'eth_getBalance',
      params: [accounts[0], 'latest'],
    });
    const balanceInt = parseInt(balanceHex, 16) / 10 ** 18;

    const balanceFormatted =
      balanceInt % 1 === 0 ? balanceInt : balanceInt.toFixed(4);

    return balanceFormatted;
  }

  async quit() {
    if (!this._server) {
      throw new Error('Server not running yet');
    }

    try {
      await this._server.close();
    } catch (e) {
      // On some systems, and in certain unknown cases, the ganache server does not close properly
      console.log('Caught error closing Ganache server', e);
    }
  }
}

module.exports = Ganache;
