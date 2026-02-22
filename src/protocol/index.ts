export {
  generateKeyPair,
  signPayload,
  verifySignature,
  generateNonce,
  type AxonKeyPair,
} from './identity.js'

export {
  Base64UrlString,
  ConnectRequestSchema,
  ConnectGrantSchema,
  DenialCodeSchema,
  ConnectDenialSchema,
  SignedMessageSchema,
  ConnectRequestValidator,
  SignedMessageValidator,
  type ConnectRequest,
  type ConnectGrant,
  type ConnectDenial,
  type DenialCode,
  type SignedMessage,
} from './schemas.js'

export { NonceStore } from './nonce.js'

export {
  AxonProtocolError,
  AxonSignatureError,
  AxonReplayError,
  AxonCredentialError,
  AxonEndpointError,
  AxonProviderNotFoundError,
} from './errors.js'
