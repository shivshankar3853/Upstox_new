const mongoose = require("mongoose");

async function connectDB() {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("✅ MongoDB Atlas Connected");
      return;
    } catch (err) {
      retries++;
      console.error(`❌ DB Connection Error (Attempt ${retries}/${maxRetries}):`, err.message);
      
      if (retries < maxRetries) {
        const waitTime = 5000 * retries; // 5s, 10s, 15s
        console.log(`⏳ Retrying in ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.error("❌ Failed to connect to MongoDB after 3 retries. Exiting...");
  process.exit(1);
}

// ==============================
// 🔍 Debug Logs (IMPORTANT)
// ==============================
mongoose.connection.on("connected", () => {
  console.log("📡 Mongoose connected");
});

mongoose.connection.on("error", (err) => {
  console.log("❌ Mongoose error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ Mongoose disconnected");
});

module.exports = connectDB;
