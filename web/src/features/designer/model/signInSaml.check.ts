/**
 * Manual check: npx vite-node src/features/designer/model/signInSaml.check.ts
 */
import { inflateSync } from 'fflate'
import {
  buildSignInSsoAuthorizeUrl,
  buildSamlRedirectAuthnRequest,
  encodeSamlRedirectRequest,
  normalizeSsoUserClaims,
} from '@/features/designer/model/signInStep'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

{
  const xml = buildSamlRedirectAuthnRequest({
    destination: 'https://login.microsoftonline.com/tenant/saml2',
    issuer: 'eca00a92-a30d-40ba-bf72-7d4c4523597d',
    acsUrl: 'https://example.com/flowforge/api/chat/sso_callback',
  })
  assert(xml.includes('AuthnRequest'), 'has AuthnRequest')
  assert(
    xml.includes('AssertionConsumerServiceURL="https://example.com/flowforge/api/chat/sso_callback"'),
    'acs',
  )
  assert(xml.includes('<saml:Issuer>eca00a92-a30d-40ba-bf72-7d4c4523597d</saml:Issuer>'), 'issuer')

  const encoded = encodeSamlRedirectRequest(xml)
  const binary = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
  const roundTrip = new TextDecoder().decode(inflateSync(binary))
  assert(roundTrip === xml, 'deflate round-trip')
}

{
  const url = buildSignInSsoAuthorizeUrl(
    {
      protocol: 'saml',
      oidcAuthorizationUrl: '',
      oidcClientId: '',
      oidcScopes: '',
      samlSsoUrl: 'https://login.microsoftonline.com/tenant/saml2',
      samlEntityId: 'my-sp',
      samlAcsUrl: 'https://old.example/c/bot',
    },
    { redirectUri: 'https://app.example/flowforge/api/chat/sso_callback', state: 'relay-1' },
  )
  assert(!!url, 'builds url')
  const parsed = new URL(url!)
  assert(parsed.searchParams.has('SAMLRequest'), 'has SAMLRequest')
  assert(parsed.searchParams.get('RelayState') === 'relay-1', 'relay state')
  const xml = new TextDecoder().decode(
    inflateSync(Uint8Array.from(atob(parsed.searchParams.get('SAMLRequest')!), (c) => c.charCodeAt(0))),
  )
  assert(
    xml.includes('AssertionConsumerServiceURL="https://app.example/flowforge/api/chat/sso_callback"'),
    'prefers redirectUri ACS',
  )
}

{
  const user = normalizeSsoUserClaims(
    {
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'a@b.com',
      'http://schemas.microsoft.com/identity/claims/objectidentifier': 'oid-1',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Ada',
    },
    { emailClaim: 'email', userIdClaim: 'sub', providerName: 'Azure' },
  )
  assert(user.email === 'a@b.com', 'email alias')
  assert(user.id === 'oid-1', 'id alias')
  assert(user.name === 'Ada', 'name alias')
}

console.log('signInSaml.check.ts: all passed')
