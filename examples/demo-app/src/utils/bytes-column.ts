import {Column} from 'typeorm';

export function ByteColumn() {
  return Column({
    type: 'varchar',
    transformer: {
      from: (string: string) => {
        return Buffer.from(string, 'hex');
      },
      to: (input: Buffer) => {
        return input.toString('hex');
      },
    },
  });

}
