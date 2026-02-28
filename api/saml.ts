/**
 * SAML 2.0 SP helpers — no external SAML library.
 *
 * Implements:
 *   - IdP metadata XML parsing  (parseIdpMetadata)
 *   - SP-initiated AuthnRequest (HTTP-Redirect binding)
 *   - SAMLResponse signature verification (HTTP-POST binding)
 *     using Exclusive Canonical XML (exc-C14N) + RSA-SHA256/SHA1 via node:crypto
 *   - SP metadata XML generation
 *
 * Security notes:
 *   - The IdP certificate MUST be pinned (from .env or IdP metadata) — the
 *     ds:KeyInfo certificate embedded inside the response is ignored for verification.
 *   - Only enveloped signatures are supported (the most common SAML pattern).
 *   - DigestValue is verified before SignatureValue (full reference validation).
 */

import { deflateRawSync } from 'node:zlib';
import { createVerify, createHash } from 'node:crypto';
// DOMParser is not available in Bun's server runtime — use the Node-compatible
// implementation from @xmldom/xmldom for XML parsing in verifySamlResponse.
// Tests run under jsdom which provides its own global DOMParser; excC14n is
// called with jsdom Elements in tests and xmldom Elements in production —
// both implement the same DOM Level 2 interface so it works everywhere.
import { DOMParser as XmlDOMParser } from '@xmldom/xmldom';

// ── Public API ──────────────────────────────────────────────────────────────

export interface IdpMetadata {
  /** IdP SSO redirect URL (HTTP-Redirect binding preferred, falls back to HTTP-POST). */
  entryPoint: string;
  /** X.509 certificate PEM body (base64, no headers). */
  cert: string;
}

/**
 * Parse a standard SAML 2.0 IdP metadata XML document (exported from Google
 * Workspace, Okta, Azure AD, etc.) and return the values needed to configure
 * the SP.  Pass the result straight into SAML_ENTRY_POINT / SAML_CERT.
 *
 * Extracts:
 *   - The first `<md:SingleSignOnService>` with HTTP-Redirect binding
 *     (falls back to HTTP-POST if Redirect is absent)
 *   - The first `<ds:X509Certificate>` in the signing `<md:KeyDescriptor>`
 *
 * @throws Error if the required elements are missing.
 */
/**
 * Parse a single attribute value from an XML element's attribute string.
 * e.g. attrVal('Binding="foo" Location="bar"', 'Location') → 'bar'
 */
function attrVal(attrs: string, name: string): string {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"`).exec(attrs);
  return m?.[1] ?? '';
}

/**
 * Find the text content of the first X509Certificate inside a KeyDescriptor
 * that matches the requested `use` attribute (or any KeyDescriptor when use is null).
 */
function certFromKeyDescriptor(xml: string, use: string | null): string | null {
  const kdRe = /<[^:\s>]*:?KeyDescriptor\b([^>]*)>([\s\S]*?)<\/[^:\s>]*:?KeyDescriptor>/g;
  let m: RegExpExecArray | null;
  while ((m = kdRe.exec(xml)) !== null) {
    const kdAttrs = m[1]!;
    const kdBody  = m[2]!;
    const useVal  = attrVal(kdAttrs, 'use') || null; // '' → null (no use attr)
    if (use !== null && useVal !== use) continue;
    const certMatch = /<[^:\s>]*:?X509Certificate[^>]*>([\s\S]*?)<\/[^:\s>]*:?X509Certificate>/
      .exec(kdBody);
    if (certMatch) return certMatch[1]!;
  }
  return null;
}

export function parseIdpMetadata(xml: string): IdpMetadata {
  // ── Entry point ──────────────────────────────────────────────────────────
  // Regex-based to avoid DOMParser (not available in Bun server runtime).
  const REDIRECT = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect';
  const POST     = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST';

  const ssoRe = /<[^:\s>]*:?SingleSignOnService\b([^>]*)\/?\s*>/g;
  let entryPoint   = '';
  let postFallback = '';
  let m: RegExpExecArray | null;
  while ((m = ssoRe.exec(xml)) !== null) {
    const attrs   = m[1]!;
    const binding = attrVal(attrs, 'Binding');
    const loc     = attrVal(attrs, 'Location');
    if (binding === REDIRECT && loc) { entryPoint = loc; break; }
    if (binding === POST     && loc) postFallback = loc;
  }
  if (!entryPoint) entryPoint = postFallback;
  if (!entryPoint) throw new Error('No SingleSignOnService found in IdP metadata');

  // ── Certificate ──────────────────────────────────────────────────────────
  // Prefer KeyDescriptor use="signing", else any KeyDescriptor, else bare cert.
  const rawCert =
    certFromKeyDescriptor(xml, 'signing') ??
    certFromKeyDescriptor(xml, null) ??
    (/<[^:\s>]*:?X509Certificate[^>]*>([\s\S]*?)<\/[^:\s>]*:?X509Certificate>/.exec(xml)?.[1] ?? null);

  if (!rawCert) throw new Error('No X509Certificate found in IdP metadata');
  const cert = rawCert.replace(/\s/g, '');
  if (!cert) throw new Error('X509Certificate element is empty');

  return { entryPoint, cert };
}

/** Build an undeflated SP AuthnRequest XML string. */
export function buildAuthnRequest(opts: {
  id: string;
  issueInstant: string;
  entryPoint: string;
  issuer: string;
  callbackUrl: string;
}): string {
  return [
    `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"`,
    ` xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
    ` ID="${escAttr(opts.id)}"`,
    ` Version="2.0"`,
    ` IssueInstant="${escAttr(opts.issueInstant)}"`,
    ` Destination="${escAttr(opts.entryPoint)}"`,
    ` AssertionConsumerServiceURL="${escAttr(opts.callbackUrl)}"`,
    ` ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">`,
    `<saml:Issuer>${escText(opts.issuer)}</saml:Issuer>`,
    `</samlp:AuthnRequest>`,
  ].join('');
}

/** Deflate + base64-encode for HTTP-Redirect binding SAMLRequest parameter. */
export function deflateEncode(xml: string): string {
  return deflateRawSync(Buffer.from(xml, 'utf8')).toString('base64');
}

/** Build SP metadata XML (for registering this SP with the IdP). */
export function buildSpMetadata(opts: { entityId: string; callbackUrl: string }): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"`,
    ` entityID="${escAttr(opts.entityId)}">`,
    `<md:SPSSODescriptor`,
    ` AuthnRequestsSigned="false"`,
    ` WantAssertionsSigned="true"`,
    ` protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">`,
    `<md:AssertionConsumerService`,
    ` Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"`,
    ` Location="${escAttr(opts.callbackUrl)}"`,
    ` index="1"/>`,
    `</md:SPSSODescriptor>`,
    `</md:EntityDescriptor>`,
  ].join('');
}

/**
 * Parse a base64-encoded SAMLResponse, verify its XML digital signature
 * against the pinned IdP certificate, and return the authenticated NameID.
 *
 * Throws a descriptive Error on any failure (parse error, missing elements,
 * signature mismatch).
 *
 * @param base64Response  The raw SAMLResponse POST parameter value.
 * @param idpCert        PEM certificate string (with or without -----BEGIN/END----- headers).
 */
export function verifySamlResponse(base64Response: string, idpCert: string): string {
  const xml = Buffer.from(base64Response.replace(/\s/g, ''), 'base64').toString('utf8');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = new XmlDOMParser().parseFromString(xml, 'text/xml') as any;
  const parseErr = (doc as Document).getElementsByTagName('parsererror')[0];
  if (parseErr) throw new Error(`SAML XML parse error: ${parseErr.textContent?.slice(0, 200) ?? 'unknown'}`);

  const NS_DS   = 'http://www.w3.org/2000/09/xmldsig#';
  const NS_SAML = 'urn:oasis:names:tc:SAML:2.0:assertion';

  const sigEls = doc.getElementsByTagNameNS(NS_DS, 'Signature');
  if (sigEls.length === 0) throw new Error('SAML response has no ds:Signature');
  const sigEl = sigEls[0]!;

  // ── 1. Locate and verify the reference digest ─────────────────────────────
  const refEl = sigEl.getElementsByTagNameNS(NS_DS, 'Reference')[0];
  if (!refEl) throw new Error('No ds:Reference');
  const refUri = refEl.getAttribute('URI') ?? '';
  const refId  = refUri.startsWith('#') ? refUri.slice(1) : refUri;

  // Find signed element by ID attribute (try common SAML ID attrs)
  let signedEl: Element | null = refId
    ? (doc.getElementById(refId) ?? findById(doc.documentElement, refId))
    : doc.documentElement;
  if (!signedEl) throw new Error(`No element with ID="${refId}"`);

  // Apply enveloped-signature transform: clone element and remove ds:Signature
  const cloned = signedEl.cloneNode(true) as Element;
  const clonedSigs = cloned.getElementsByTagNameNS(NS_DS, 'Signature');
  while (clonedSigs.length > 0) clonedSigs[0]!.parentNode!.removeChild(clonedSigs[0]!);

  const digestMethodEl = refEl.getElementsByTagNameNS(NS_DS, 'DigestMethod')[0];
  const digestAlgUri   = digestMethodEl?.getAttribute('Algorithm') ?? '';
  const digestAlg      = digestAlgUri.includes('sha256') ? 'sha256' : 'sha1';

  const digestValueEl = refEl.getElementsByTagNameNS(NS_DS, 'DigestValue')[0];
  if (!digestValueEl) throw new Error('No ds:DigestValue');
  const expectedDigest = (digestValueEl.textContent ?? '').replace(/\s/g, '');

  const canonicalSigned = excC14n(cloned);
  const actualDigest    = createHash(digestAlg).update(canonicalSigned, 'utf8').digest('base64');
  if (actualDigest !== expectedDigest) throw new Error('SAML DigestValue mismatch');

  // ── 2. Verify SignatureValue over canonicalized ds:SignedInfo ─────────────
  const signedInfoEl = sigEl.getElementsByTagNameNS(NS_DS, 'SignedInfo')[0];
  if (!signedInfoEl) throw new Error('No ds:SignedInfo');

  const sigValueEl = sigEl.getElementsByTagNameNS(NS_DS, 'SignatureValue')[0];
  if (!sigValueEl) throw new Error('No ds:SignatureValue');
  const sigValue = (sigValueEl.textContent ?? '').replace(/\s/g, '');

  const sigMethodEl = sigEl.getElementsByTagNameNS(NS_DS, 'SignatureMethod')[0];
  const sigAlgUri   = sigMethodEl?.getAttribute('Algorithm') ?? '';
  const cryptoAlg   = sigAlgUri.toLowerCase().includes('sha256') ? 'RSA-SHA256' : 'RSA-SHA1';

  const canonicalisedInfo = excC14n(signedInfoEl);
  const pem    = normPem(idpCert);
  const verify = createVerify(cryptoAlg);
  verify.update(canonicalisedInfo, 'utf8');
  if (!verify.verify(pem, sigValue, 'base64')) throw new Error('SAML signature verification failed');

  // ── 3. Extract NameID ────────────────────────────────────────────────────
  const nameIdEl = doc.getElementsByTagNameNS(NS_SAML, 'NameID')[0];
  if (!nameIdEl) throw new Error('NameID not found in SAML assertion');
  const nameId = nameIdEl.textContent?.trim() ?? '';
  if (!nameId) throw new Error('NameID is empty');
  return nameId;
}

// ── Exclusive Canonical XML (exc-C14N) ──────────────────────────────────────
//
// Reference: https://www.w3.org/TR/xml-exc-c14n/
// Handles the subset required for SAML signature operations.

/**
 * Serialize `el` using Exclusive Canonical XML.
 * `inherited` is the set of (prefix→uri) namespace bindings visible from
 * the parent context (empty at the top level).
 */
export function excC14n(el: Element, inherited: Map<string, string> = new Map()): string {
  // Collect namespaces visibly utilised in this subtree
  const used = collectUsedNS(el);

  // Render only those that differ from the inherited context
  const render: Map<string, string> = new Map();
  for (const [prefix, uri] of used) {
    if (inherited.get(prefix) !== uri) render.set(prefix, uri);
  }

  // Sort: default ns ('') first, then lexicographic by prefix
  const sortedNS = [...render.entries()].sort(([a], [b]) =>
    a === '' ? -1 : b === '' ? 1 : a.localeCompare(b),
  );

  // Sort non-namespace attributes: by namespace URI then local name
  const attrs: Attr[] = [];
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i]!;
    if (!a.name.startsWith('xmlns')) attrs.push(a);
  }
  attrs.sort((a, b) => {
    const aNS = a.namespaceURI ?? '';
    const bNS = b.namespaceURI ?? '';
    return aNS !== bNS ? aNS.localeCompare(bNS) : a.localName.localeCompare(b.localName);
  });

  let out = `<${el.tagName}`;
  for (const [prefix, uri] of sortedNS) {
    out += prefix === '' ? ` xmlns="${escAttrC14n(uri)}"` : ` xmlns:${prefix}="${escAttrC14n(uri)}"`;
  }
  for (const a of attrs) out += ` ${a.name}="${escAttrC14n(a.value)}"`;
  out += '>';

  const childNS = new Map([...inherited, ...render]);
  // Index-based loop: xmldom NodeList is not iterable (no Symbol.iterator).
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes.item(i);
    if (!child) continue;
    if (child.nodeType === 1 /* ELEMENT */) {
      out += excC14n(child as Element, childNS);
    } else if (child.nodeType === 3 /* TEXT */) {
      out += c14nText(child.textContent ?? '');
    }
  }

  out += `</${el.tagName}>`;
  return out;
}

// ── Internal utilities ───────────────────────────────────────────────────────

function findById(root: Element, id: string): Element | null {
  // Walk the tree looking for ID / id / AssertionID attributes
  for (const attr of ['ID', 'id', 'AssertionID']) {
    if (root.getAttribute(attr) === id) return root;
  }
  // Use childNodes + nodeType check for compatibility with xmldom (no .children in v0.8)
  // Use index-based loop: xmldom NodeList is not iterable (no Symbol.iterator).
  for (let i = 0; i < root.childNodes.length; i++) {
    const child = root.childNodes.item(i);
    if (child && child.nodeType === 1) {
      const found = findById(child as Element, id);
      if (found) return found;
    }
  }
  return null;
}

/** Collect all (prefix→uri) pairs visibly utilised in el's subtree. */
function collectUsedNS(el: Element): Map<string, string> {
  const ns: Map<string, string> = new Map();
  if (el.namespaceURI) ns.set(el.prefix ?? '', el.namespaceURI);
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i]!;
    if (a.namespaceURI && !a.name.startsWith('xmlns')) ns.set(a.prefix ?? '', a.namespaceURI);
  }
  // Index-based loop: xmldom NodeList is not iterable (no Symbol.iterator).
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes.item(i);
    if (child && child.nodeType === 1) {
      for (const [p, u] of collectUsedNS(child as Element)) ns.set(p, u);
    }
  }
  return ns;
}

function normPem(cert: string): string {
  const trimmed = cert.trim();
  // Already has a PEM header (certificate or public key) — return as-is.
  if (trimmed.startsWith('-----BEGIN ')) return trimmed + '\n';
  // Raw base64 body — wrap as X.509 certificate.
  const chunks = trimmed.replace(/\s/g, '').match(/.{1,64}/g)!;
  return `-----BEGIN CERTIFICATE-----\n${chunks.join('\n')}\n-----END CERTIFICATE-----\n`;
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttrC14n(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\t/g, '&#9;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;');
}
function c14nText(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
