import {Column} from 'typeorm';

export function ByteColumn() {
  return Column({
    type: 'bytea',
    transformer: {
      from: (value: any) => {
      },
      to: (input: unknown) => {
        if (typeof input === 'string') {
          input = Buffer.from(input);
        }
        if (Buffer.isBuffer(input)) {
          return `\\x${input.toString('hex').toUpperCase()}`;
        }
        throw new Error('Unsupported types');
      },
    },
  });

}
