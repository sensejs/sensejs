import {CompressionTypes, CompressionCodecs} from 'kafkajs';
import zstd from 'zstd-napi';

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
