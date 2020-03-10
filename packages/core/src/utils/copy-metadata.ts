
/**
 * Due to the reason that the polyfill 'reflect-metadata' does not support proxy reflect metadata,
 * or it's actually ECMA standard issue. We have to copy reflect metadata from origin to proxy
 *
 * @param destination To where the metadata will be copied
 * @param source From where the metadata will be copied
 */
export function copyMetadata(destination: object, source: object) {
  for (const key of Reflect.getOwnMetadataKeys(source)) {
    Reflect.defineMetadata(key, Reflect.getOwnMetadata(key, source), destination);
  }
}
