import type { MongooseModuleOptions } from '@nestjs/mongoose';

/** Pure configuration: never connects, logs a URI, or changes database users. */
export function buildMongoOptions(env: NodeJS.ProcessEnv = process.env): MongooseModuleOptions {
  const uri = env.MONGODB_URI?.trim();
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error('MONGODB_URI is required and must be a MongoDB URI.');
  let parsed: URL;
  try { parsed = new URL(uri); } catch { throw new Error('MONGODB_URI is invalid.'); }
  const database = parsed.pathname.slice(1);
  if (!/^[A-Za-z0-9_-]+$/.test(database) || ['admin', 'local', 'config'].includes(database)) {
    throw new Error('MONGODB_URI must specify one application database.');
  }
  const testUri = 'mongodb://127.0.0.1:27017/salgados_financeiro_test';
  if ((env.NODE_ENV === 'test' || env.TEST_MONGODB_URI) && (uri !== testUri || (env.TEST_MONGODB_URI && env.TEST_MONGODB_URI !== testUri))) {
    throw new Error('Tests require the isolated salgados_financeiro_test URI.');
  }
  const user = env.MONGODB_USER?.trim();
  const pass = env.MONGODB_PASSWORD;
  if (Boolean(user) !== Boolean(pass)) throw new Error('MONGODB_USER and MONGODB_PASSWORD must be provided together.');
  if (user && (parsed.username || parsed.password)) throw new Error('Provide MongoDB credentials through either environment fields or URI, not both.');
  const tls = env.MONGODB_TLS === 'true' || parsed.protocol === 'mongodb+srv:' || parsed.searchParams.get('tls') === 'true';
  const production = env.NODE_ENV === 'production';
  if (production) {
    if (!(user && pass) && !(parsed.username && parsed.password)) throw new Error('Production MongoDB requires application credentials.');
    if (!tls || parsed.searchParams.get('tls') === 'false' || parsed.searchParams.get('ssl') === 'false') throw new Error('Production MongoDB requires TLS.');
    for (const option of ['tlsInsecure', 'tlsAllowInvalidCertificates', 'tlsAllowInvalidHostnames']) {
      if (parsed.searchParams.get(option) === 'true') throw new Error('Insecure MongoDB TLS options are forbidden.');
    }
    if (['root', 'admin'].includes((user || decodeURIComponent(parsed.username)).toLowerCase())) throw new Error('Use a dedicated MongoDB application user.');
  }
  return {
    uri, dbName: database, ...(user ? { user, pass } : {}),
    ...(tls ? { tls: true } : {}), ...(env.MONGODB_TLS_CA_FILE ? { tlsCAFile: env.MONGODB_TLS_CA_FILE } : {}),
    autoIndex: false, autoCreate: false,
    serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000, maxPoolSize: 20,
  };
}
