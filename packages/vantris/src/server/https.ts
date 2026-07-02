import { readFile } from "node:fs/promises";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import type { KeyObject } from "node:crypto";
import type { Logger } from "../types/logger.js";
import type { ResolvedServerConfig } from "../types/config-resolved.js";
import { resolveFrom } from "../utils/paths.js";

/** Resolved TLS material, or `false` when HTTPS is disabled. */
export type ResolvedTls = false | { cert: string; key: string };

/**
 * Resolves the `server.https` option into concrete cert/key PEM material.
 *
 * - `false` → HTTPS off.
 * - `true` → a freshly generated **self-signed development** certificate (with
 *   a clear CLI warning).
 * - `{ cert, key }` → the given PEM, read from disk when a path is provided.
 */
export async function resolveHttps(
  https: ResolvedServerConfig["https"],
  root: string,
  logger: Logger,
): Promise<ResolvedTls> {
  if (!https) return false;
  if (https === true) {
    logger.warn(
      "https: using a self-signed development certificate — browsers will warn; not for production.",
    );
    return generateSelfSigned();
  }
  return {
    cert: await loadPem(https.cert, root),
    key: await loadPem(https.key, root),
  };
}

/** Uses a value as literal PEM, or reads it from disk when it's a path. */
async function loadPem(value: string, root: string): Promise<string> {
  if (value.includes("-----BEGIN")) return value;
  return readFile(resolveFrom(root, value), "utf8");
}

// ─── Minimal DER/ASN.1 encoder ──────────────────────────────────────────────
// Node can generate key pairs but has no API to build an X.509 certificate, so
// we encode a tiny self-signed cert by hand. Scope is deliberately narrow: one
// RSA leaf for `localhost`/`127.0.0.1`, signed with SHA-256.

const enum Tag {
  Boolean = 0x01,
  Integer = 0x02,
  BitString = 0x03,
  OctetString = 0x04,
  Null = 0x05,
  Oid = 0x06,
  Utf8 = 0x0c,
  Sequence = 0x30,
  Set = 0x31,
  UtcTime = 0x17,
}

function tlv(tag: number, value: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLength(value.length), value]);
}

function encodeLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  let n = length;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

const seq = (...parts: Buffer[]): Buffer => tlv(Tag.Sequence, Buffer.concat(parts));
const set = (...parts: Buffer[]): Buffer => tlv(Tag.Set, Buffer.concat(parts));
const nullValue = (): Buffer => tlv(Tag.Null, Buffer.alloc(0));

/** Positive INTEGER — prepends 0x00 when the high bit is set. */
function integer(value: Buffer): Buffer {
  const body = value[0]! & 0x80 ? Buffer.concat([Buffer.from([0]), value]) : value;
  return tlv(Tag.Integer, body);
}

function oid(dotted: string): Buffer {
  const parts = dotted.split(".").map(Number);
  const bytes = [40 * parts[0]! + parts[1]!];
  for (let i = 2; i < parts.length; i++) {
    let value = parts[i]!;
    const chunk = [value & 0x7f];
    value >>= 7;
    while (value > 0) {
      chunk.unshift((value & 0x7f) | 0x80);
      value >>= 7;
    }
    bytes.push(...chunk);
  }
  return tlv(Tag.Oid, Buffer.from(bytes));
}

function bitString(value: Buffer): Buffer {
  return tlv(Tag.BitString, Buffer.concat([Buffer.from([0]), value])); // 0 unused bits
}

function utcTime(date: Date): Buffer {
  const stamp = date.toISOString().replace(/[-:T]/g, "").slice(2, 14) + "Z"; // YYMMDDHHMMSSZ
  return tlv(Tag.UtcTime, Buffer.from(stamp, "ascii"));
}

/** A distinguished name with a single CN. */
function commonName(cn: string): Buffer {
  return seq(set(seq(oid("2.5.4.3"), tlv(Tag.Utf8, Buffer.from(cn, "utf8")))));
}

function extension(dotted: string, critical: boolean, value: Buffer): Buffer {
  const parts = [oid(dotted)];
  if (critical) parts.push(tlv(Tag.Boolean, Buffer.from([0xff])));
  parts.push(tlv(Tag.OctetString, value));
  return seq(...parts);
}

const SHA256_RSA = seq(oid("1.2.840.113549.1.1.11"), nullValue());

/** Generates a self-signed RSA certificate for localhost. */
export function generateSelfSigned(): { cert: string; key: string } {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const spki = publicKey.export({ type: "spki", format: "der" });

  const now = new Date();
  const notAfter = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  // subjectAltName: DNS:localhost + IP:127.0.0.1 (context tags [2] and [7]).
  const san = extension(
    "2.5.29.17",
    false,
    seq(
      tlv(0x82, Buffer.from("localhost", "ascii")),
      tlv(0x87, Buffer.from([127, 0, 0, 1])),
    ),
  );
  const basicConstraints = extension("2.5.29.19", true, seq()); // cA = FALSE
  const extensions = tlv(0xa3, seq(san, basicConstraints)); // [3] EXPLICIT

  const tbs = seq(
    tlv(0xa0, integer(Buffer.from([2]))), // version v3
    integer(randomBytes(8)), // serial number
    SHA256_RSA,
    commonName("localhost"), // issuer (self-signed)
    seq(utcTime(now), utcTime(notAfter)),
    commonName("localhost"), // subject
    spki as Buffer,
    extensions,
  );

  const signature = sign("sha256", tbs, privateKey as KeyObject);
  const certificate = seq(tbs, SHA256_RSA, bitString(signature));

  return {
    cert: toPem(certificate, "CERTIFICATE"),
    key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

/** Wraps DER bytes as a PEM block. */
function toPem(der: Buffer, label: string): string {
  const base64 = der.toString("base64").replace(/(.{64})/g, "$1\n");
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----\n`;
}
