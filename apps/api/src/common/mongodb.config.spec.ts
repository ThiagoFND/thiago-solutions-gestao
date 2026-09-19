import { buildMongoOptions } from './mongodb.config.js';

describe('MongoDB connection boundary (no connection)', () => {
  const uri = 'mongodb://127.0.0.1:27017/salgados_financeiro_test';
  it('requires URI and explicit application database', () => {
    expect(() => buildMongoOptions({})).toThrow('MONGODB_URI');
    expect(() => buildMongoOptions({ MONGODB_URI: 'mongodb://localhost/admin' })).toThrow('application database');
  });
  it('pins test mode to exact allowed URI', () => {
    expect(() => buildMongoOptions({ NODE_ENV: 'test', MONGODB_URI: 'mongodb://localhost/other' })).toThrow('isolated');
    expect(buildMongoOptions({ NODE_ENV: 'test', MONGODB_URI: uri })).toMatchObject({ uri, autoIndex: false, autoCreate: false });
  });
  it('rejects connection parameters in test mode', () => {
    expect(() => buildMongoOptions({ NODE_ENV: 'test', MONGODB_URI: uri + '?replicaSet=rs0&directConnection=true' })).toThrow('isolated');
  });
  it('pins both URI fields when TEST_MONGODB_URI enables test mode', () => {
    expect(buildMongoOptions({ MONGODB_URI: uri, TEST_MONGODB_URI: uri })).toMatchObject({ uri });
    expect(() => buildMongoOptions({ MONGODB_URI: 'mongodb://localhost/other', TEST_MONGODB_URI: uri })).toThrow('isolated');
    expect(() => buildMongoOptions({ MONGODB_URI: uri, TEST_MONGODB_URI: uri + '?directConnection=true' })).toThrow('isolated');
  });
  it('requires production credentials and TLS', () => {
    expect(() => buildMongoOptions({ NODE_ENV: 'production', MONGODB_URI: uri })).toThrow('credentials');
    expect(() => buildMongoOptions({ NODE_ENV: 'production', MONGODB_URI: uri, MONGODB_USER: 'app', MONGODB_PASSWORD: 'test-only' })).toThrow('TLS');
  });
  it('rejects insecure production TLS flags', () => {
    expect(() => buildMongoOptions({ NODE_ENV: 'production', MONGODB_URI: uri + '?tls=true&tlsInsecure=true', MONGODB_USER: 'app', MONGODB_PASSWORD: 'test-only' })).toThrow('Insecure');
  });
  it('accepts authenticated TLS with index creation disabled', () => {
    expect(buildMongoOptions({ NODE_ENV: 'production', MONGODB_URI: uri, MONGODB_TLS: 'true', MONGODB_USER: 'app', MONGODB_PASSWORD: 'test-only' })).toMatchObject({ tls: true, user: 'app', autoIndex: false });
  });
});
