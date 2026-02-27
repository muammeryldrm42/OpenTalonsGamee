// MIT License — Copyright (c) 2026 OpenTalons Contributors
//
// src/parsers/RezLoader.ts — Parser for Captain Claw (1997) .REZ archive format.
//
// ── REZ Format Reference ─────────────────────────────────────────────────────
// The REZ format is a hierarchical archive used by Monolith's RIOT engine.
// Structure:
//
//   [File Header]        — 8-byte magic + 4-byte version + 4-byte root offset
//   [Directory Tree]     — Recursive directory entries (DirNode)
//   [File Entries]       — FileNode records pointing to raw data
//   [Raw Data Blocks]    — Concatenated file payloads
//
// All values are little-endian.
// String fields are null-terminated, padded to the declared length.
//
// Credits: Format documented by the OpenClaw / Freeablo communities.

// ── Constants ────────────────────────────────────────────────────────────────
const REZ_MAGIC = 0x5a455200;           // "REZ\0" as 32-bit LE
const REZ_MAGIC_ALT = 0x205a4552;      // " REZ" as 32-bit LE (unused alternative magic)
const REZ_VERSION = 1;
const DIRECTORY_FLAG = 0x01;
const FILE_FLAG = 0x00;
const STRING_SIZE = 32;                 // Max name length in bytes including null terminator

// ── Type Definitions ─────────────────────────────────────────────────────────

export interface RezFileEntry {
  name: string;
  path: string;           // Full virtual path, e.g. "/SOUNDS/AMBIENT/RAIN.WAV"
  extension: string;      // e.g. "WAV"
  offset: number;         // Byte offset of raw data inside the .REZ file
  size: number;           // Uncompressed size in bytes
  time: number;           // Modification timestamp (DOS format)
}

export interface RezDirectoryEntry {
  name: string;
  path: string;
  files: Map<string, RezFileEntry>;
  directories: Map<string, RezDirectoryEntry>;
}

export type RezFileSystem = RezDirectoryEntry;

export interface RezArchive {
  version: number;
  fs: RezFileSystem;
  /** Total number of file entries in the archive */
  fileCount: number;
  /** Get raw bytes for a given virtual path (case-insensitive) */
  readFile(path: string): Uint8Array;
  /** List all files under a virtual directory path */
  listDir(path: string): RezFileEntry[];
  /** Check whether a file exists */
  exists(path: string): boolean;
}

// ── Internal parse structures ─────────────────────────────────────────────────

interface RawDirEntry {
  offset: number;        // Offset to the next sibling or 0 if last
  dataOffset: number;    // Offset to children (for dir) or data (for file)
  size: number;          // Size of data block (files only)
  time: number;          // DOS timestamp
  flags: number;         // 0 = file, 1 = directory
  nameLen: number;       // Length of the name string incl. null
  extLen: number;        // Length of extension string (files only)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a .REZ archive from a browser File or raw ArrayBuffer.
 *
 * @example
 * const file = document.getElementById('rez-input').files[0];
 * const archive = await RezLoader.load(file);
 * const bytes = archive.readFile('/SOUNDS/AMBIENT/RAIN.WAV');
 */
export class RezLoader {

  // ── Entry points ────────────────────────────────────────────────────────

  static async load(source: File | ArrayBuffer | Uint8Array): Promise<RezArchive> {
    let buffer: ArrayBuffer;

    if (source instanceof File) {
      buffer = await source.arrayBuffer();
    } else if (source instanceof Uint8Array) {
      buffer = source.buffer as ArrayBuffer;
    } else {
      buffer = source;
    }

    return RezLoader.parse(buffer);
  }

  // ── Core parser ─────────────────────────────────────────────────────────

  private static parse(buffer: ArrayBuffer): RezArchive {
    const view = new DataView(buffer);
    const raw = new Uint8Array(buffer);

    // ---- Header (20 bytes) ------------------------------------------------
    // Offset  Size  Field
    //  0x00    4    Magic ("REZ\0" or "REZ " for old versions)
    //  0x04    4    Version (should be 1)
    //  0x08    4    Root directory offset
    //  0x0C    4    Root directory size
    //  0x10    4    (reserved)

    const magic = view.getUint32(0, false); // big-endian magic check
    const magicStr = String.fromCharCode(
      raw[0], raw[1], raw[2]
    );

    if (magicStr !== 'REZ' && magicStr !== 'rez') {
      throw new RezParseError(
        `Invalid REZ magic: expected "REZ" at offset 0, got "${magicStr}"`
      );
    }

    const version = view.getUint32(0x04, true);
    if (version !== REZ_VERSION) {
      console.warn(`[RezLoader] Unexpected version ${version}; attempting parse anyway.`);
    }

    const rootOffset = view.getUint32(0x08, true);
    // const rootSize   = view.getUint32(0x0C, true); // not needed for parsing

    // ---- Recursive directory parse ----------------------------------------
    const root: RezDirectoryEntry = {
      name: '',
      path: '/',
      files: new Map(),
      directories: new Map(),
    };

    let fileCount = 0;

    const parseDirectory = (
      dir: RezDirectoryEntry,
      entryOffset: number
    ): void => {
      let offset = entryOffset;

      while (offset !== 0 && offset < buffer.byteLength) {
        // ---- Entry header (fixed 44 bytes before variable-length strings) ----
        // Offset  Size  Field
        //  +0x00   4    Offset to next sibling entry (0 = last in directory)
        //  +0x04   4    Offset to data / children
        //  +0x08   4    Data size (files), 0 for dirs
        //  +0x0C   4    DOS timestamp
        //  +0x10   1    Flags (0 = file, 1 = directory)
        //  +0x11   1    Name length (including null byte)
        //  +0x12   1    Extension length (including null byte, 0 for dirs)
        //  +0x13   1    (padding)
        //  +0x14   ?    Name string (null-terminated)
        //  +0x14+N ?    Extension string (null-terminated, files only)

        if (offset + 0x14 > buffer.byteLength) break;

        const nextOffset  = view.getUint32(offset + 0x00, true);
        const dataOffset  = view.getUint32(offset + 0x04, true);
        const dataSize    = view.getUint32(offset + 0x08, true);
        const timestamp   = view.getUint32(offset + 0x0C, true);
        const flags       = raw[offset + 0x10];
        const nameLen     = raw[offset + 0x11];
        const extLen      = raw[offset + 0x12];

        const nameStart = offset + 0x14;
        const name = RezLoader.readNullString(raw, nameStart, nameLen);

        let ext = '';
        if (extLen > 0) {
          const extStart = nameStart + nameLen;
          ext = RezLoader.readNullString(raw, extStart, extLen);
        }

        const childPath = dir.path === '/'
          ? `/${name}`
          : `${dir.path}/${name}`;

        if (flags === DIRECTORY_FLAG) {
          // ---- Directory node ----------------------------------------------
          const childDir: RezDirectoryEntry = {
            name,
            path: childPath,
            files: new Map(),
            directories: new Map(),
          };
          dir.directories.set(name.toUpperCase(), childDir);

          if (dataOffset !== 0) {
            parseDirectory(childDir, dataOffset);
          }
        } else {
          // ---- File node ---------------------------------------------------
          const fileEntry: RezFileEntry = {
            name,
            path: childPath,
            extension: ext.toUpperCase(),
            offset: dataOffset,
            size: dataSize,
            time: timestamp,
          };
          dir.files.set(name.toUpperCase(), fileEntry);
          fileCount++;
        }

        offset = nextOffset;
      }
    };

    parseDirectory(root, rootOffset);

    // ---- Construct and return the RezArchive object -----------------------
    return new RezArchiveImpl(buffer, root, version, fileCount);
  }

  // ── Utility: read a null-terminated ASCII string from a Uint8Array ───────

  private static readNullString(
    raw: Uint8Array,
    offset: number,
    maxLen: number
  ): string {
    let end = offset;
    const limit = Math.min(offset + maxLen, raw.length);
    while (end < limit && raw[end] !== 0) end++;
    return String.fromCharCode(...raw.slice(offset, end));
  }
}

// ── RezArchive Implementation ─────────────────────────────────────────────────

class RezArchiveImpl implements RezArchive {
  public readonly version: number;
  public readonly fs: RezFileSystem;
  public readonly fileCount: number;
  private readonly buffer: ArrayBuffer;

  constructor(
    buffer: ArrayBuffer,
    fs: RezFileSystem,
    version: number,
    fileCount: number
  ) {
    this.buffer = buffer;
    this.fs = fs;
    this.version = version;
    this.fileCount = fileCount;
  }

  readFile(path: string): Uint8Array {
    const entry = this.resolveFile(path);
    if (!entry) {
      throw new RezFileNotFoundError(path);
    }
    return new Uint8Array(this.buffer, entry.offset, entry.size);
  }

  exists(path: string): boolean {
    return this.resolveFile(path) !== null;
  }

  listDir(dirPath: string): RezFileEntry[] {
    const dir = this.resolveDir(dirPath);
    if (!dir) return [];
    const results: RezFileEntry[] = [];
    this.collectFiles(dir, results);
    return results;
  }

  // ── Path resolution ──────────────────────────────────────────────────────

  private resolveFile(path: string): RezFileEntry | null {
    const parts = this.normalizePath(path);
    if (parts.length === 0) return null;

    const fileName = parts[parts.length - 1].toUpperCase();
    const dirParts = parts.slice(0, -1);
    const dir = this.walkDir(this.fs, dirParts);
    if (!dir) return null;

    return dir.files.get(fileName) ?? null;
  }

  private resolveDir(path: string): RezDirectoryEntry | null {
    const parts = this.normalizePath(path);
    return this.walkDir(this.fs, parts);
  }

  private walkDir(
    root: RezDirectoryEntry,
    parts: string[]
  ): RezDirectoryEntry | null {
    let current = root;
    for (const part of parts) {
      const child = current.directories.get(part.toUpperCase());
      if (!child) return null;
      current = child;
    }
    return current;
  }

  private normalizePath(path: string): string[] {
    return path.replace(/\\/g, '/').split('/').filter((p) => p.length > 0);
  }

  private collectFiles(dir: RezDirectoryEntry, out: RezFileEntry[]): void {
    for (const file of dir.files.values()) out.push(file);
    for (const subDir of dir.directories.values()) {
      this.collectFiles(subDir, out);
    }
  }
}

// ── Custom Errors ─────────────────────────────────────────────────────────────

export class RezParseError extends Error {
  constructor(message: string) {
    super(`[RezLoader] Parse error: ${message}`);
    this.name = 'RezParseError';
  }
}

export class RezFileNotFoundError extends Error {
  constructor(path: string) {
    super(`[RezLoader] File not found in archive: "${path}"`);
    this.name = 'RezFileNotFoundError';
  }
}
