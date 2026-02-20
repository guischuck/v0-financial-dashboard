import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 32
const TAG_LENGTH = 16
const KEY_LENGTH = 32

function getKey(salt: Buffer): Buffer {
    const rawKey = process.env.ENCRYPTION_KEY
    if (!rawKey) throw new Error('ENCRYPTION_KEY is not set in environment variables')
    return scryptSync(rawKey, salt, KEY_LENGTH)
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string: salt:iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
    const salt = randomBytes(SALT_LENGTH)
    const iv = randomBytes(IV_LENGTH)
    const key = getKey(salt)

    const cipher = createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64')
}

/**
 * Decrypts a base64-encoded encrypted string produced by `encrypt()`.
 */
export function decrypt(encryptedData: string): string {
    const data = Buffer.from(encryptedData, 'base64')

    const salt = data.subarray(0, SALT_LENGTH)
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const authTag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
    const ciphertext = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH)

    const key = getKey(salt)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    return decipher.update(ciphertext) + decipher.final('utf8')
}

/**
 * Masks a key for display, showing only last 4 chars.
 * e.g. "sk_test_abc123" → "••••••••••••123"
 */
export function maskApiKey(key: string): string {
    if (!key || key.length <= 4) return '••••'
    return '•'.repeat(Math.min(12, key.length - 4)) + key.slice(-4)
}
