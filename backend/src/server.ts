import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/database/db.config";
import { seedSystemRoles } from "./seed/roles.seed";

const PORT = process.env.PORT || 5000;

async function start(): Promise<void> {
    await connectDB();
    await seedSystemRoles();

    app.listen(PORT, () => {
        console.log(`🚀 IMSN Server running on port ${PORT}`);
    });
}

start().catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
});