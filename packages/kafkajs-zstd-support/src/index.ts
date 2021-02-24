import {CompressionTypes, CompressionCodecs} from 'kafkajs';
import zstd from 'zstd-napi';

if (CompressionCodecs[CompressionTypes.ZSTD]) {
  throw new Error('Zstd Codec has already been defined for kafkajs');
}

const zstdKafkaCodec = () => {
  const compressor = new zstd.Compressor();
  const decompressor = new zstd.Decompressor();
  return {
    async compress(encoder: any) {
      return compressor.compress(encoder.buffer);
    },

    async decompress(buffer: any) {
      return decompressor.decompress(buffer);
    },
  };
};

CompressionCodecs[CompressionTypes.ZSTD] = zstdKafkaCodec;
