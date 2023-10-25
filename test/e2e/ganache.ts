import { Server, server } from 'ganache';
import { retry, retryUntilTrue } from '../../development/lib/retry';

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

// This enum is from `ganache/packages/ethereum/ethereum/src/blockchain.ts`
// but I don't think you can import it from here
enum Status {
  // Flags
  started = 1, // 0000 0001
  starting = 2, // 0000 0010
  stopped = 4, // 0000 0100
  stopping = 8, // 0000 1000
  paused = 16, // 0001 0000
}

const ganacheInstancesByPort: Record<number, GanacheInstance> = {};

export async function startNewGanache(opts: any) {
  const options = { ...defaultOptions, ...opts };
  const { port } = options;

  let ganache = ganacheInstancesByPort[port];

  if (!ganache) {
    ganache = new GanacheInstance(); // eslint-disable-line @typescript-eslint/no-use-before-define
    ganacheInstancesByPort[port] = ganache;
  } else if (ganache.needsStopping()) {
    console.log('Ganache instance already running on port', port);
    await ganache.quit();
  }

  retry(
    {
      retries: 2,
      delay: 1000,
    },
    async () => {
      try {
        await ganache.start(options);
      } catch (e) {
        console.log('Caught error starting Ganache server', e);
        await ganache.quit();
        throw e; // We need to throw the error out to retry()
      }
    },
  );

  return ganache;
}

class GanacheInstance {
  #server: Server | undefined;

  #port = 0;

  async start(options: any) {
    this.#server = server(options);
    this.#port = options.port;

    await this.#server.listen(options.port);
  }

  getProvider() {
    return this.#server?.provider;
  }

  async getAccounts() {
    return await this.getProvider()?.request({
      method: 'eth_accounts',
      params: [],
    });
  }

  async getBalance() {
    const accounts = await this.getAccounts();
    const provider = await this.getProvider();

    if (!accounts || !accounts[0] || !provider) {
      console.log('No accounts found');
      return 0;
    }

    const balanceHex = await provider.request({
      method: 'eth_getBalance',
      params: [accounts[0], 'latest'],
    });
    const balanceInt = parseInt(balanceHex, 16) / 10 ** 18;

    const balanceFormatted =
      balanceInt % 1 === 0 ? balanceInt : balanceInt.toFixed(4);

    return balanceFormatted;
  }

  needsStopping() {
    return (
      this.#server &&
      (this.#server.status === Status.started ||
        this.#server.status === Status.starting)
    );
  }

  async quit() {
    if (!this.#server) {
      throw new Error('Server not running yet');
    }

    try {
      await this.#server.close();
    } catch (e) {
      // On some systems, and in certain unknown cases, the ganache server does not close properly
      console.log('Caught on status', this.#server.status);
      console.log('Caught error closing Ganache server', e);

      await retryUntilTrue(
        {
          retries: 5,
          delay: 1000,
        },
        () => {
          console.log('status in retry', this.#server?.status);
          return this.#server?.status === Status.stopped;
        },
      );

      console.log('status out', this.#server.status);
    }
  }
}
