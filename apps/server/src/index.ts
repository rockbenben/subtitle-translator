import { createApp } from "./app.js";
import { serverConfig } from "./config.js";

const app = await createApp();

await app.listen({ port: serverConfig.port, host: serverConfig.host });
