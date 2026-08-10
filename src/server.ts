import app from "./app.js"
import "dotenv/config.js"

const start = async () => {
    const PORT = Number(process.env.PORT ?? 5000)
    try {
        await app.listen({port: PORT})
        console.log(`Server started at ${PORT}`);
    } catch (error) {
        app.log.error(error)
        process.exit(1)
    }
}

start()