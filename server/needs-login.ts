export default class NeedsLogin extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'NeedsLogin';
    // setPrototypeOf explanation:
    // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, NeedsLogin.prototype);
  }
}
