import type busboy from '@fastify/busboy';

/**
 * A multipart file entry
 */
export interface MultipartFileEntry<Content> {
  type: 'file';
  /**
   * The name of the file field
   */
  name: string;

  /**
   * The filename of the file, provided by the client or browser
   */
  filename: string;

  /**
   * The file content, the type of it depends on the implementation.
   * For the default implementation of in-memory handler, it's a buffer,
   * For the default implementation of file handler, it's a ReadableStream to the file.
   */
  content: Content;

  transferEncoding: string;

  mimeType: string;

  size: number;
}

export interface MultipartFieldEntry {
  type: 'field';
  /**
   * The name of the field
   */
  name: string;
  /**
   * The value of the field
   */
  value: string;

  transferEncoding: string;

  mimeType: string;
}

export interface MultipartFileInfo {
  filename: string;

  mimeType: string;

  transferEncoding: string;
}

export type MultipartEntry<Content> = MultipartFileEntry<Content> | MultipartFieldEntry;

export abstract class MultipartFileStorage<Content> {
  abstract readonly fileSizeLimit: number;

  abstract readonly fileCountLimit: number;

  abstract saveMultipartFile(
    name: string,
    file: NodeJS.ReadableStream,
    info: MultipartFileInfo,
  ): Promise<MultipartFileEntry<Content>>;

  abstract clean(): Promise<void>;
}

export interface MultipartFileStorageOption {
  fileSizeLimit?: number;
  fileCountLimit?: number;
}
