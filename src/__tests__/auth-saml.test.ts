/**
 * SAML SSO test fixture.
 *
 * Tests the SAML helper functions in api/saml.ts end-to-end:
 * - Building an AuthnRequest
 * - Generating and verifying a complete signed SAMLResponse (the critical path)
 * - Exclusive C14N canonicalization
 * - Error handling for tampered / unsigned responses
 *
 * Runtime note: these tests run in the jsdom environment (vitest.config.ts),
 * which provides a global DOMParser — the same API used in api/saml.ts.
 */

import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, createSign, createHash } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import {
  buildAuthnRequest,
  deflateEncode,
  buildSpMetadata,
  verifySamlResponse,
  excC14n,
  parseIdpMetadata,
} from '../../api/saml.ts';

// ── Test fixture: build + sign a SAMLResponse ────────────────────────────────

/**
 * Constructs a minimal but spec-compliant signed SAML 2.0 Response suitable
 * for testing `verifySamlResponse`.
 *
 * The assertion is signed via an enveloped RSA-SHA256 signature using
 * Exclusive Canonical XML (exc-C14N):
 *   1.  Canonical form of the assertion (sans signature) → SHA-256 DigestValue
 *   2.  Canonical form of ds:SignedInfo (containing the digest) → SignatureValue
 */
function buildSignedSamlResponse(opts: {
  nameId: string;
  assertionId: string;
  issuer?: string;
  privateKey: KeyObject;
}): string {
  const now      = '2026-01-01T00:00:00.000Z';
  const issuer   = opts.issuer ?? 'test-idp';

  // ── 1. Build assertion XML (no signature yet) ───────────────────────────
  const assertionXml = [
    `<saml:Assertion`,
    ` xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
    ` ID="${opts.assertionId}"`,
    ` Version="2.0"`,
    ` IssueInstant="${now}">`,
    `<saml:Issuer>${issuer}</saml:Issuer>`,
    `<saml:Subject>`,
    `<saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">`,
    opts.nameId,
    `</saml:NameID>`,
    `</saml:Subject>`,
    `</saml:Assertion>`,
  ].join('');

  // ── 2. Compute C14N digest of assertion ─────────────────────────────────
  const assertionDoc = new DOMParser().parseFromString(assertionXml, 'text/xml');
  const canonAssertion = excC14n(assertionDoc.documentElement);
  const digest = createHash('sha256').update(canonAssertion, 'utf8').digest('base64');

  // ── 3. Build ds:SignedInfo ───────────────────────────────────────────────
  const signedInfoXml = [
    `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">`,
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>`,
    `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>`,
    `<ds:Reference URI="#${opts.assertionId}">`,
    `<ds:Transforms>`,
    `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>`,
    `<ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>`,
    `</ds:Transforms>`,
    `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>`,
    `<ds:DigestValue>${digest}</ds:DigestValue>`,
    `</ds:Reference>`,
    `</ds:SignedInfo>`,
  ].join('');

  // ── 4. Canonicalize ds:SignedInfo and sign it ─────────────────────────────
  const siDoc         = new DOMParser().parseFromString(signedInfoXml, 'text/xml');
  const canonSI       = excC14n(siDoc.documentElement);
  const signer        = createSign('RSA-SHA256');
  signer.update(canonSI, 'utf8');
  const sigValue      = signer.sign(opts.privateKey, 'base64');

  // ── 5. Assemble ds:Signature element ─────────────────────────────────────
  const signatureXml = [
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">`,
    signedInfoXml,
    `<ds:SignatureValue>${sigValue}</ds:SignatureValue>`,
    `</ds:Signature>`,
  ].join('');

  // ── 6. Insert signature into assertion after Issuer ───────────────────────
  const signedAssertionXml = assertionXml.replace(
    `<saml:Issuer>${issuer}</saml:Issuer>`,
    `<saml:Issuer>${issuer}</saml:Issuer>${signatureXml}`,
  );

  // ── 7. Wrap in a samlp:Response ──────────────────────────────────────────
  const responseXml = [
    `<samlp:Response`,
    ` xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"`,
    ` xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
    ` ID="_response001"`,
    ` Version="2.0"`,
    ` IssueInstant="${now}">`,
    signedAssertionXml,
    `</samlp:Response>`,
  ].join('');

  return Buffer.from(responseXml).toString('base64');
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('SAML helpers (api/saml.ts)', () => {
  // Generate a test RSA-2048 key pair once for the entire suite.
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  // Export as PKCS#8 PEM — createVerify() and normPem() both accept this format.
  const pubPem = publicKey.export({ format: 'pem', type: 'spki' }) as string;

  // ── buildAuthnRequest ───────────────────────────────────────────────────────
  describe('buildAuthnRequest', () => {
    it('includes all required SAML attributes', () => {
      const xml = buildAuthnRequest({
        id: '_test123',
        issueInstant: '2026-01-01T00:00:00Z',
        entryPoint: 'https://idp.example.com/sso/saml',
        issuer: 'my-sp',
        callbackUrl: 'https://app.example.com/saml/callback',
      });
      expect(xml).toContain('samlp:AuthnRequest');
      expect(xml).toContain('ID="_test123"');
      expect(xml).toContain('Version="2.0"');
      expect(xml).toContain('Destination="https://idp.example.com/sso/saml"');
      expect(xml).toContain('AssertionConsumerServiceURL="https://app.example.com/saml/callback"');
      expect(xml).toContain('<saml:Issuer>my-sp</saml:Issuer>');
    });

    it('escapes XML special characters in string values', () => {
      const xml = buildAuthnRequest({
        id: '_x',
        issueInstant: '2026-01-01T00:00:00Z',
        entryPoint: 'https://idp.example.com/sso',
        issuer: 'issuer & <special>',
        callbackUrl: 'https://app.example.com/saml/callback',
      });
      expect(xml).toContain('issuer &amp; &lt;special&gt;');
    });
  });

  // ── deflateEncode ───────────────────────────────────────────────────────────
  describe('deflateEncode', () => {
    it('returns a non-empty base64 string', () => {
      const xml     = buildAuthnRequest({ id: '_x', issueInstant: '2026-01-01T00:00:00Z', entryPoint: 'https://idp.example.com', issuer: 'sp', callbackUrl: 'https://app.example.com/acs' });
      const encoded = deflateEncode(xml);
      expect(encoded).toBeTruthy();
      // Must be valid base64
      expect(() => Buffer.from(encoded, 'base64')).not.toThrow();
      expect(Buffer.from(encoded, 'base64').length).toBeGreaterThan(0);
    });
  });

  // ── buildSpMetadata ─────────────────────────────────────────────────────────
  describe('buildSpMetadata', () => {
    it('contains entity ID, ACS URL and SPSSODescriptor', () => {
      const xml = buildSpMetadata({ entityId: 'my-sp', callbackUrl: 'https://app.example.com/acs' });
      expect(xml).toContain('entityID="my-sp"');
      expect(xml).toContain('Location="https://app.example.com/acs"');
      expect(xml).toContain('SPSSODescriptor');
      expect(xml).toContain('WantAssertionsSigned="true"');
    });
  });

  // ── verifySamlResponse ──────────────────────────────────────────────────────
  describe('verifySamlResponse', () => {
    it('returns NameID for a correctly signed response', () => {
      const b64 = buildSignedSamlResponse({ nameId: 'alice@example.com', assertionId: '_a001', privateKey });
      expect(verifySamlResponse(b64, pubPem)).toBe('alice@example.com');
    });

    it('handles email NameIDs with plus signs and dots', () => {
      const b64 = buildSignedSamlResponse({ nameId: 'user.name+tag@example.co.uk', assertionId: '_a002', privateKey });
      expect(verifySamlResponse(b64, pubPem)).toBe('user.name+tag@example.co.uk');
    });

    it('throws when SAMLResponse is not valid base64 XML', () => {
      expect(() => verifySamlResponse('definitely-not-xml!!!', pubPem)).toThrow();
    });

    it('throws "No ds:Signature" when the response is unsigned', () => {
      const unsignedXml = [
        `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">`,
        `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_unsigned">`,
        `<saml:NameID>eve@example.com</saml:NameID>`,
        `</saml:Assertion></samlp:Response>`,
      ].join('');
      const b64 = Buffer.from(unsignedXml).toString('base64');
      expect(() => verifySamlResponse(b64, pubPem)).toThrow('SAML response has no ds:Signature');
    });

    it('throws on signature mismatch when signed with wrong private key', () => {
      const { privateKey: wrongKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const b64 = buildSignedSamlResponse({ nameId: 'mallory@example.com', assertionId: '_a003', privateKey: wrongKey });
      // Verification uses pubPem (corresponding to the original privateKey) — mismatch
      expect(() => verifySamlResponse(b64, pubPem)).toThrow();
    });

    it('throws "DigestValue mismatch" when assertion content is tampered after signing', () => {
      // Build a valid response then flip one byte in the base64 body of the XML
      const b64  = buildSignedSamlResponse({ nameId: 'victim@example.com', assertionId: '_a004', privateKey });
      const xml  = Buffer.from(b64, 'base64').toString('utf8');
      // Replace the NameID content to simulate content tampering
      const tampered = xml.replace('victim@example.com', 'attacker@example.com');
      expect(() => verifySamlResponse(Buffer.from(tampered).toString('base64'), pubPem)).toThrow();
    });
  });

  // ── parseIdpMetadata ────────────────────────────────────────────────────────
  describe('parseIdpMetadata', () => {
    const FAKE_CERT = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArx1SBwbjf5QWa';

    const googleStyleMetadata = (redirectUrl: string, cert: string): string => `
<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="https://accounts.google.com/o/saml2?idpid=TEST">
  <md:IDPSSODescriptor WantAuthnRequestsSigned="false"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data><ds:X509Certificate>${cert}</ds:X509Certificate></ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:SingleSignOnService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${redirectUrl}"/>
    <md:SingleSignOnService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${redirectUrl}"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`.trim();

    it('extracts entryPoint and cert from Google-style metadata', () => {
      const xml    = googleStyleMetadata('https://accounts.google.com/o/saml2/idp?idpid=TEST', FAKE_CERT);
      const result = parseIdpMetadata(xml);
      expect(result.entryPoint).toBe('https://accounts.google.com/o/saml2/idp?idpid=TEST');
      expect(result.cert).toBe(FAKE_CERT);
    });

    it('prefers HTTP-Redirect binding over HTTP-POST', () => {
      const xml = `
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="test">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data><ds:X509Certificate>${FAKE_CERT}</ds:X509Certificate></ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://idp.example.com/post"/>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com/redirect"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`.trim();
      expect(parseIdpMetadata(xml).entryPoint).toBe('https://idp.example.com/redirect');
    });

    it('falls back to HTTP-POST when HTTP-Redirect is absent', () => {
      const xml = `
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="test">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data><ds:X509Certificate>${FAKE_CERT}</ds:X509Certificate></ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://idp.example.com/post"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`.trim();
      expect(parseIdpMetadata(xml).entryPoint).toBe('https://idp.example.com/post');
    });

    it('strips whitespace from the certificate value', () => {
      const certWithNewlines = `MIIBIjANBg\nkqhkiG9w0B\nAQEFAAOCAQ8A`;
      const xml    = googleStyleMetadata('https://idp.example.com', certWithNewlines);
      const result = parseIdpMetadata(xml);
      expect(result.cert).toBe('MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A');
      expect(result.cert).not.toMatch(/\s/);
    });

    it('throws when XML is malformed', () => {
      expect(() => parseIdpMetadata('<broken><xml')).toThrow();
    });

    it('throws when no SingleSignOnService is present', () => {
      const xml = `
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="test">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data><ds:X509Certificate>${FAKE_CERT}</ds:X509Certificate></ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`.trim();
      expect(() => parseIdpMetadata(xml)).toThrow('No SingleSignOnService');
    });

    it('throws when no X509Certificate is present', () => {
      const xml = `
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="test">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`.trim();
      expect(() => parseIdpMetadata(xml)).toThrow('No X509Certificate');
    });
  });

  // ── excC14n ─────────────────────────────────────────────────────────────────
  describe('excC14n', () => {
    it('renders namespace declaration for the element prefix', () => {
      const doc   = new DOMParser().parseFromString(
        `<ds:Foo xmlns:ds="http://example.com/ds"><ds:Bar>text</ds:Bar></ds:Foo>`,
        'text/xml',
      );
      const canon = excC14n(doc.documentElement);
      expect(canon).toBe(`<ds:Foo xmlns:ds="http://example.com/ds"><ds:Bar>text</ds:Bar></ds:Foo>`);
    });

    it('omits namespace already provided via inherited context', () => {
      const doc   = new DOMParser().parseFromString(
        `<ds:Child xmlns:ds="http://example.com/ds">hello</ds:Child>`,
        'text/xml',
      );
      const inherited = new Map([['ds', 'http://example.com/ds']]);
      const canon     = excC14n(doc.documentElement, inherited);
      // 'ds' is already in scope — must NOT be re-declared
      expect(canon).not.toContain('xmlns:ds');
      expect(canon).toBe('<ds:Child>hello</ds:Child>');
    });

    it('sorts attributes lexicographically by local name', () => {
      const doc   = new DOMParser().parseFromString(
        `<El z="3" a="1" m="2"/>`,
        'text/xml',
      );
      const canon = excC14n(doc.documentElement);
      const aPos  = canon.indexOf('a="1"');
      const mPos  = canon.indexOf('m="2"');
      const zPos  = canon.indexOf('z="3"');
      expect(aPos).toBeLessThan(mPos);
      expect(mPos).toBeLessThan(zPos);
    });

    it('escapes special characters in attribute values', () => {
      const doc   = new DOMParser().parseFromString(
        `<El val="a&amp;b&lt;c&gt;d"/>`,
        'text/xml',
      );
      const canon = excC14n(doc.documentElement);
      expect(canon).toContain('val="a&amp;b&lt;c&gt;d"');
    });

    it('normalises CR+LF to LF in text nodes', () => {
      const doc   = new DOMParser().parseFromString(
        `<El>line1&#13;&#10;line2</El>`,
        'text/xml',
      );
      const canon = excC14n(doc.documentElement);
      expect(canon).toBe('<El>line1\nline2</El>');
    });
  });
});
