import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("OPSBACKUP-ENC-V1");
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function getBackupEncryptionKey() {
  const value = process.env.BACKUP_ENCRYPTION_KEY ?? process.env.BACKUP_ENCRYPTION_PASSPHRASE;
  return value && value.trim() ? value.trim() : null;
}

export function isBackupEncryptionConfigured() {
  return Boolean(getBackupEncryptionKey());
}

export function isEncryptedBackupFile(contents: Buffer) {
  return contents.length >= MAGIC.length + IV_LENGTH + TAG_LENGTH && contents.subarray(0, MAGIC.length).equals(MAGIC);
}

export function encryptBackupFile(contents: Buffer) {
  const key = getBackupEncryptionKey();
  if (!key) return { encrypted: false, contents };
  const encryptionKey = createHash("sha256").update(key).digest();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(contents), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: true,
    contents: Buffer.concat([MAGIC, iv, tag, encrypted]),
  };
}

export function decryptBackupFile(contents: Buffer) {
  if (!isEncryptedBackupFile(contents)) return contents;
  const key = getBackupEncryptionKey();
  if (!key) throw new Error("Backup encryption key is not configured");
  const encryptionKey = createHash("sha256").update(key).digest();
  const iv = contents.subarray(MAGIC.length, MAGIC.length + IV_LENGTH);
  const tag = contents.subarray(MAGIC.length + IV_LENGTH, MAGIC.length + IV_LENGTH + TAG_LENGTH);
  const payload = contents.subarray(MAGIC.length + IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]);
}

export function normalizeBackupInput(contents: Buffer) {
  return isEncryptedBackupFile(contents) ? decryptBackupFile(contents) : contents;
}
