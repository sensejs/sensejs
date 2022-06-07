import kafkajs from 'kafkajs';
import * as zn from 'zstd-napi';

const zstdKafkaCodec = () => {
  const compressor = new zn.Compressor();
  const decompressor = new zn.Decompressor();
  return {
    async compress(encoder: any) {
      return compressor.compress(encoder.buffer);
    },

    async decompress(buffer: any) {
      return decompressor.decompress(buffer);
    },
  };
};

kafkajs.CompressionCodecs[kafkajs.CompressionTypes.ZSTD] = zstdKafkaCodec;
