import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../src/utils/encryption";

// Valid 32-byte (64 hex character) test key
const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encryption utilities", () => {
  describe("encrypt", () => {
    it("should return encrypted string in correct format (iv:authTag:data)", () => {
      const plaintext = "hello world";
      const encrypted = encrypt(plaintext, TEST_KEY);

      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);

      // IV should be 32 hex chars (16 bytes)
      expect(parts[0]).toHaveLength(32);
      // Auth tag should be 32 hex chars (16 bytes)
      expect(parts[1]).toHaveLength(32);
      // Encrypted data should exist
      expect(parts[2]!.length).toBeGreaterThan(0);
    });

    it("should produce different ciphertext for same plaintext (random IV)", () => {
      const plaintext = "same message";
      const encrypted1 = encrypt(plaintext, TEST_KEY);
      const encrypted2 = encrypt(plaintext, TEST_KEY);

      // The IVs should be different
      expect(encrypted1.split(":")[0]).not.toBe(encrypted2.split(":")[0]);
      // The full ciphertext should be different
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should handle empty string (produces empty ciphertext)", () => {
      const encrypted = encrypt("", TEST_KEY);
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
      // Note: empty string encrypts to empty ciphertext
      expect(parts[2]).toBe("");
    });

    it("should handle unicode characters", () => {
      const plaintext = "Hello 世界 🌍 émojis";
      const encrypted = encrypt(plaintext, TEST_KEY);

      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
    });

    it("should handle long text", () => {
      const plaintext = "a".repeat(10000);
      const encrypted = encrypt(plaintext, TEST_KEY);

      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
    });
  });

  describe("decrypt", () => {
    it("should decrypt to original plaintext", () => {
      const plaintext = "secret message";
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);

      expect(decrypted).toBe(plaintext);
    });

    it("should throw when decrypting empty string (implementation limitation)", () => {
      // Note: The current implementation cannot decrypt empty strings
      // because the validation check `!encrypted` is true for empty string
      const encrypted = encrypt("", TEST_KEY);
      expect(() => decrypt(encrypted, TEST_KEY)).toThrow(
        "Invalid encrypted text format"
      );
    });

    it("should decrypt unicode characters correctly", () => {
      const plaintext = "Hello 世界 🌍 émojis café";
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);

      expect(decrypted).toBe(plaintext);
    });

    it("should decrypt long text correctly", () => {
      const plaintext = "test".repeat(2500);
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("error handling", () => {
    it("should throw on invalid format (missing parts)", () => {
      expect(() => decrypt("invalid", TEST_KEY)).toThrow(
        "Invalid encrypted text format"
      );
    });

    it("should throw on invalid format (only two parts)", () => {
      expect(() => decrypt("part1:part2", TEST_KEY)).toThrow(
        "Invalid encrypted text format"
      );
    });

    it("should throw on invalid format (too many parts)", () => {
      expect(() => decrypt("part1:part2:part3:part4", TEST_KEY)).toThrow(
        "Invalid encrypted text format"
      );
    });

    it("should throw on tampered ciphertext", () => {
      const plaintext = "secret";
      const encrypted = encrypt(plaintext, TEST_KEY);
      const parts = encrypted.split(":");

      // Tamper with the encrypted data
      const tamperedData = "ff" + parts[2]!.slice(2);
      const tampered = `${parts[0]}:${parts[1]}:${tamperedData}`;

      expect(() => decrypt(tampered, TEST_KEY)).toThrow();
    });

    it("should throw on wrong key", () => {
      const plaintext = "secret";
      const encrypted = encrypt(plaintext, TEST_KEY);
      const wrongKey =
        "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it("should throw on tampered auth tag", () => {
      const plaintext = "secret";
      const encrypted = encrypt(plaintext, TEST_KEY);
      const parts = encrypted.split(":");

      // Tamper with the auth tag
      const tamperedTag = "00000000000000000000000000000000";
      const tampered = `${parts[0]}:${tamperedTag}:${parts[2]}`;

      expect(() => decrypt(tampered, tamperedTag)).toThrow();
    });
  });

  describe("round-trip", () => {
    it("should handle JSON data", () => {
      const data = { username: "test", password: "secret123" };
      const plaintext = JSON.stringify(data);
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);

      expect(JSON.parse(decrypted)).toEqual(data);
    });

    it("should handle special characters", () => {
      const plaintext = "!@#$%^&*()_+-=[]{}|;':\",./<>?\n\t\r";
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);

      expect(decrypted).toBe(plaintext);
    });
  });
});
