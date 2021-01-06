import type { RequestMessage } from '../../shared/interfaces';

let socketID = 0;

export default class Socket {
  readonly id = (socketID += 1);

  private errored = false;

  readonly url: string;

  private _connection?: Promise<WebSocket>;

  private verbose: boolean;

  private log(...args: unknown[]) {
    // eslint-disable-next-line no-console
    if (this.verbose) console.log(...args);
  }

  private get connection(): Promise<WebSocket> {
    return (this._connection ??= new Promise((resolve, reject) => {
      this.log('Socket', this.id, 'opening');
      const connection = new WebSocket(this.url);
      connection.onerror = () => {
        reject();
        this.errored = true;
      };
      connection.onopen = () => {
        this.log('Socket', this.id, 'opened to state', connection?.readyState);
        resolve(connection);
      };
      connection.onmessage = (message) => this.messageHandler(message, this);
      connection.onclose = () => this.closedHandler(this.errored);
    }));
  }

  messageHandler: (message: MessageEvent, socket: Socket) => void;

  closedHandler: (errored: boolean) => void;

  constructor(
    url: string,
    messageHandler: (message: MessageEvent, socket: Socket) => void,
    closedHandler: (errored: boolean) => void,
    { verbose = false } = {},
  ) {
    this.url = url;
    this.messageHandler = messageHandler;
    this.closedHandler = closedHandler;
    this.verbose = verbose;
  }

  private async send(data: string | ArrayBuffer | SharedArrayBuffer | Blob | ArrayBufferView) {
    const connection = await this.connection;
    this.log('Socket', this.id, 'is in state', connection?.readyState);
    if (connection.readyState !== connection.OPEN)
      throw new Error(`Cannot send data, socket #${this.id} is in state ${connection.readyState}`);
    connection.send(data);
    this.log('Sent', data);
  }

  async sendRequest(message: RequestMessage): Promise<void> {
    this.log('Socket', this.id, 'sending', message);
    await this.send(JSON.stringify(message));
  }

  async close(): Promise<void> {
    if (this._connection) (await this.connection).close();
  }
}
