import type {Readable} from 'stream';

/**
 * A multipart file entry
 */
export interface MultipartFileEntry {
  type: 'file';
  /**
   * The name of the file field
   */
  name: string;

  /**
   * The filename of the file, provided by the client or browser
   */
  filename: string;

  body: () => Readable;

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

export type MultipartEntry<File extends MultipartFileEntry = MultipartFileEntry> = File | MultipartFieldEntry;

export abstract class MultipartFileStorage<File extends MultipartFileEntry = MultipartFileEntry> {
  abstract readonly fileSizeLimit: number;

  abstract readonly fileCountLimit: number;

  abstract saveMultipartFile(name: string, file: NodeJS.ReadableStream, info: MultipartFileInfo): Promise<File>;

  abstract clean(): Promise<void>;
}

export interface MultipartFileStorageOption {
  fileSizeLimit?: number;
  fileCountLimit?: number;
}
