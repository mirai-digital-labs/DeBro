import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.BACKEND_PORT || '9000', 10),
  db: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/universal_commerce_db',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  cors: {
    storefront: process.env.STORE_CORS || 'http://localhost:3000',
    admin: process.env.ADMIN_CORS || 'http://localhost:7001',
  },
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_jwt_key_nexstore_2026',
  pakistanPayments: {
    jazzcash: {
      merchantId: process.env.JAZZCASH_MERCHANT_ID || 'sandbox_merchant',
      password: process.env.JAZZCASH_PASSWORD || 'sandbox_pass',
      salt: process.env.JAZZCASH_INTEGRITY_SALT || 'sandbox_salt',
    },
    easypaisa: {
      storeId: process.env.EASYPAISA_STORE_ID || 'sandbox_store',
      hashKey: process.env.EASYPAISA_HASH_KEY || 'sandbox_hash',
    },
    cod: {
      maxLimitPkr: parseInt(process.env.COD_MAX_LIMIT_PKR || '50000', 10),
      otpVerificationThreshold: parseInt(process.env.COD_OTP_VERIFICATION_THRESHOLD || '10000', 10),
    },
  },
};
