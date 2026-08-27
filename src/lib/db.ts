import mongoose from "mongoose"

function obtenerUri(): string {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("La variable de entorno MONGODB_URI no está definida.")
  }
  return uri
}

type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }

const globalWithCache = globalThis as typeof globalThis & { mongooseCache?: MongooseCache }

const cached: MongooseCache = globalWithCache.mongooseCache ?? { conn: null, promise: null }
globalWithCache.mongooseCache = cached

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(obtenerUri()).then((m) => m)
  }

  cached.conn = await cached.promise
  return cached.conn
}
