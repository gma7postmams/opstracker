import archiver from "archiver";
import * as yauzl from "yauzl";
import { createWriteStream } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

const PACKAGE_NAME = "OpsTrackerBackup";
const PACKAGE_VERSION = 1;
const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 10_000;

type ArchiveFile = { entry: yauzl.Entry; relativePath: string };
type ArchiveContents = {
  zip: yauzl.ZipFile;
  databaseEntry: yauzl.Entry;
  manifestEntry: yauzl.Entry;
  uploadFiles: ArchiveFile[];
  includesUploads: boolean;
};

export type ParsedBackupPackage = {
  databaseContents: Buffer;
  includesUploads: boolean;
};

export type StagedUploadRestore = {
  activate: () => Promise<void>;
  rollback: () => Promise<void>;
  commit: () => Promise<void>;
};

export function isBackupPackage(contents: Buffer) {
  return contents.length >= 4 && contents[0] === 0x50 && contents[1] === 0x4b
    && [0x03, 0x05, 0x07].includes(contents[2]) && [0x04, 0x06, 0x08].includes(contents[3]);
}

function safeArchivePath(name: string) {
  if (!name || name.includes("\0") || name.includes("\\") || name.startsWith("/") || /^[a-zA-Z]:/.test(name)) return false;
  const parts = name.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== ".." && !part.includes(":"));
}

async function openArchive(contents: Buffer): Promise<ArchiveContents> {
  if (contents.length > MAX_ARCHIVE_BYTES) throw new Error("Backup package is too large");
  const zip = await yauzl.fromBufferPromise(contents, {
    autoClose: false,
    lazyEntries: true,
    strictFileNames: true,
    validateEntrySizes: true,
  });
  try {
    const entries: yauzl.Entry[] = [];
    await new Promise<void>((resolve, reject) => {
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        entries.push(entry);
        if (entries.length > MAX_ARCHIVE_ENTRIES) {
          reject(new Error("Backup package contains too many entries"));
          return;
        }
        zip.readEntry();
      });
      zip.on("end", resolve);
      zip.readEntry();
    });

    let uncompressedBytes = 0;
    let databaseEntry: yauzl.Entry | undefined;
    let manifestEntry: yauzl.Entry | undefined;
    const uploadFiles: ArchiveFile[] = [];
    const names = new Set<string>();

    for (const entry of entries) {
      const directoryEntry = entry.fileName.endsWith("/");
      const name = directoryEntry ? entry.fileName.slice(0, -1) : entry.fileName;
      if (!safeArchivePath(name) || names.has(name)) throw new Error("Backup package contains an unsafe or duplicate path");
      names.add(name);
      if (entry.isEncrypted() || !entry.canDecodeFileData()) throw new Error("Backup package uses unsupported ZIP features");

      const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
      const fileType = mode & 0o170000;
      if (fileType === 0o120000 || (fileType !== 0 && fileType !== 0o100000 && fileType !== 0o040000)) {
        throw new Error("Backup package contains an unsupported file type");
      }
      if (directoryEntry) {
        if (name !== "uploads" && !name.startsWith("uploads/")) throw new Error("Backup package contains an unexpected directory");
        continue;
      }

      uncompressedBytes += entry.uncompressedSize;
      if (entry.uncompressedSize < 0 || uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
        throw new Error("Backup package expands beyond the allowed size");
      }
      if (name === "database.json") databaseEntry = entry;
      else if (name === "manifest.json") manifestEntry = entry;
      else if (name.startsWith("uploads/")) {
        const relativePath = name.slice("uploads/".length);
        if (!safeArchivePath(relativePath)) throw new Error("Backup package contains an unsafe upload path");
        uploadFiles.push({ entry, relativePath });
      } else {
        throw new Error("Backup package contains an unexpected entry");
      }
    }

    if (!databaseEntry || !manifestEntry) throw new Error("Backup package is missing its manifest or database data");
    const manifest = JSON.parse((await readEntry(zip, manifestEntry)).toString("utf8"));
    if (manifest.package !== PACKAGE_NAME || manifest.packageVersion !== PACKAGE_VERSION || manifest.backupFormat !== 2) {
      throw new Error("Unsupported OpsTracker backup package version");
    }
    if (typeof manifest.includesUploads !== "boolean" || manifest.includesUploads !== (uploadFiles.length > 0)) {
      throw new Error("Backup package upload manifest does not match its contents");
    }

    return { zip, databaseEntry, manifestEntry, uploadFiles, includesUploads: manifest.includesUploads };
  } catch (error) {
    zip.close();
    throw error;
  }
}

function readEntry(zip: yauzl.ZipFile, entry: yauzl.Entry) {
  return new Promise<Buffer>((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error) { reject(error); return; }
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  });
}

async function listUploadFiles(root: string) {
  const files: { absolutePath: string; relativePath: string }[] = [];
  async function visit(directory: string, prefix: string) {
    let items;
    try {
      items = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && directory === root) return;
      throw error;
    }
    for (const item of items) {
      const relativePath = prefix ? `${prefix}/${item.name}` : item.name;
      if (!safeArchivePath(`uploads/${relativePath}`)) throw new Error("Uploads directory contains an unsafe path");
      const absolutePath = path.join(directory, item.name);
      if (item.isSymbolicLink()) throw new Error("Uploads directory contains an unsupported symbolic link");
      if (item.isDirectory()) await visit(absolutePath, relativePath);
      else if (item.isFile()) files.push({ absolutePath, relativePath });
    }
  }
  await visit(root, "");
  return files;
}

export async function createBackupPackage(
  databaseContents: Buffer,
  exportedAt: string,
  uploadsDirectory: string,
  temporaryPath: string,
) {
  const files = await listUploadFiles(uploadsDirectory);
  const includesUploads = files.length > 0;
  const manifest = {
    package: PACKAGE_NAME,
    packageVersion: PACKAGE_VERSION,
    backupFormat: 2,
    exportedAt,
    includesUploads,
    uploadFileCount: files.length,
  };
  const createArchive = archiver as unknown as (
    format: "zip",
    options: { zlib: { level: number } },
  ) => import("archiver").Archiver;
  const archive = createArchive("zip", { zlib: { level: 6 } });
  const output = createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 });
  const outputClosed = new Promise<void>((resolve, reject) => {
    output.once("close", resolve);
    output.once("error", reject);
    archive.once("error", reject);
  });

  archive.pipe(output);
  archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
  archive.append(databaseContents, { name: "database.json" });
  for (const file of files) archive.file(file.absolutePath, { name: `uploads/${file.relativePath}` });
  await archive.finalize();
  await outputClosed;
  return { includesUploads, uploadFileCount: files.length };
}

export async function parseBackupPackage(contents: Buffer): Promise<ParsedBackupPackage> {
  const packageContents = await openArchive(contents);
  try {
    return {
      databaseContents: await readEntry(packageContents.zip, packageContents.databaseEntry),
      includesUploads: packageContents.includesUploads,
    };
  } finally {
    packageContents.zip.close();
  }
}

async function copyUploadTree(source: string, destination: string) {
  let items;
  try {
    items = await readdir(source, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const item of items) {
    if (item.isSymbolicLink()) throw new Error("Current uploads contain an unsupported symbolic link");
    if (!safeArchivePath(`uploads/${item.name}`)) throw new Error("Current uploads contain an unsafe path");
    const sourcePath = path.join(source, item.name);
    const destinationPath = path.join(destination, item.name);
    if (item.isDirectory()) {
      await mkdir(destinationPath, { recursive: true });
      await copyUploadTree(sourcePath, destinationPath);
    } else if (item.isFile()) {
      await copyFile(sourcePath, destinationPath);
    }
  }
}

export async function stageBackupUploads(contents: Buffer, uploadsDirectory: string, mode: "merge" | "replace") {
  const packageContents = await openArchive(contents);
  const parentDirectory = path.dirname(uploadsDirectory);
  await mkdir(parentDirectory, { recursive: true });
  await mkdir(uploadsDirectory, { recursive: true });
  const [uploadsInfo, parentInfo] = await Promise.all([stat(uploadsDirectory), stat(parentDirectory)]);
  const uploadsIsMount = uploadsInfo.dev !== parentInfo.dev;
  const stagingDirectory = await mkdtemp(path.join(parentDirectory, ".opstracker-uploads-stage-"));
  const previousName = `.opstracker-uploads-previous-${randomUUID()}`;
  const previousDirectory = path.join(uploadsIsMount ? uploadsDirectory : parentDirectory, previousName);

  try {
    if (mode === "merge") await copyUploadTree(uploadsDirectory, stagingDirectory);
    for (const { entry, relativePath } of packageContents.uploadFiles) {
      const destinationPath = path.resolve(stagingDirectory, ...relativePath.split("/"));
      if (!destinationPath.startsWith(`${stagingDirectory}${path.sep}`)) throw new Error("Unsafe upload destination");
      await mkdir(path.dirname(destinationPath), { recursive: true });
      await rm(destinationPath, { recursive: true, force: true });
      const stream = await packageContents.zip.openReadStreamPromise(entry);
      await pipeline(stream, createWriteStream(destinationPath, { flags: "wx", mode: 0o600 }));
    }
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  } finally {
    packageContents.zip.close();
  }

  let movedPrevious = false;
  let activated = false;
  let mountPreviousPrepared = false;
  const movedMountEntries: string[] = [];
  return {
    async activate() {
      if (uploadsIsMount) {
        await mkdir(previousDirectory);
        const currentEntries = await readdir(uploadsDirectory, { withFileTypes: true });
        for (const entry of currentEntries) {
          if (entry.name === previousName) continue;
          await rename(path.join(uploadsDirectory, entry.name), path.join(previousDirectory, entry.name));
          movedMountEntries.push(entry.name);
        }
        mountPreviousPrepared = true;
        await copyUploadTree(stagingDirectory, uploadsDirectory);
        activated = true;
        return;
      }
      try {
        const current = await lstat(uploadsDirectory);
        if (current) {
          await rename(uploadsDirectory, previousDirectory);
          movedPrevious = true;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      try {
        await rename(stagingDirectory, uploadsDirectory);
        activated = true;
      } catch (error) {
        if (movedPrevious) await rename(previousDirectory, uploadsDirectory);
        throw error;
      }
    },
    async rollback() {
      if (uploadsIsMount) {
        if (mountPreviousPrepared) {
          const currentEntries = await readdir(uploadsDirectory, { withFileTypes: true });
          for (const entry of currentEntries) {
            if (entry.name !== previousName) {
              await rm(path.join(uploadsDirectory, entry.name), { recursive: true, force: true });
            }
          }
        }
        for (const entry of movedMountEntries) {
          await rename(path.join(previousDirectory, entry), path.join(uploadsDirectory, entry));
        }
        await rm(previousDirectory, { recursive: true, force: true });
        await rm(stagingDirectory, { recursive: true, force: true });
        return;
      }
      if (activated) await rm(uploadsDirectory, { recursive: true, force: true });
      if (movedPrevious) await rename(previousDirectory, uploadsDirectory);
      await rm(stagingDirectory, { recursive: true, force: true });
    },
    async commit() {
      if (uploadsIsMount || movedPrevious) await rm(previousDirectory, { recursive: true, force: true });
      if (uploadsIsMount) await rm(stagingDirectory, { recursive: true, force: true });
    },
  } satisfies StagedUploadRestore;
}