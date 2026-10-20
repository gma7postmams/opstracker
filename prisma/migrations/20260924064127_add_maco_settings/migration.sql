CREATE TABLE "ai_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "macoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'ollama',
    "baseUrl" TEXT NOT NULL DEFAULT 'http://localhost:11434',
    "model" TEXT NOT NULL DEFAULT 'llama3.1:8b',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);
