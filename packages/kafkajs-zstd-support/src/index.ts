import {CompressionTypes, CompressionCodecs} from 'kafkajs';
import {Compressor, Decompressor} from 'zstd-napi';

const zstdKafkaCodec = () => {
  const compressor = new Compressor();
  const decompressor = new Decompressor();
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
