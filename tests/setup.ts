import "dotenv/config";

// Force NODE_ENV=test pour que les rate limiters soient désactivés
process.env.NODE_ENV = "test";