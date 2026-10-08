import { MongoMemoryServer } from "mongodb-memory-server"

const PORT = Number(process.env.MONGO_PORT ?? 27017)
const DB_NAME = process.env.MONGO_DB ?? "encuestas"

async function main() {
  const mongod = await MongoMemoryServer.create({
    instance: { port: PORT, dbName: DB_NAME, ip: "127.0.0.1" },
  })

  console.log("\n  MongoDB en memoria listo")
  console.log(`  URI: mongodb://127.0.0.1:${PORT}/${DB_NAME}\n`)

  const detener = async () => {
    await mongod.stop()
    process.exit(0)
  }

  process.on("SIGINT", detener)
  process.on("SIGTERM", detener)
}

main().catch((error) => {
  console.error("No se pudo iniciar MongoDB en memoria:", error)
  process.exit(1)
})
