export class Client {
  async count(): Promise<any> {
    const _shards = {failed: 0, successful: 1, total: 1};
    return {_shards, count: 1};
  }

  close(): void {}
}
