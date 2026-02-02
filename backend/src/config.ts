/**
 * Configuration for the Survey AI backend
 */

export const config = {
  port: process.env.PORT || 3001,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  environment: process.env.NODE_ENV || "development",
};
