require("dotenv").config();

const express = require("express");
const http = require("http");
const session = require("express-session");
const { Server } = require("socket.io");

const { getProfile } = require("./profileService");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

global.io = io;

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("trust proxy", 1);

app.use(session({
  secret: "supersecret",
  proxy: true,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // Auto-detect HTTPS and set secure cookie accordingly.
    secure: "auto",
    sameSite: "lax",

  }
}));

// ================= STATIC =================
app.use(express.static("public"));

// ================= SERVICES =================
const { syncOrders } = require("./syncService");
const { loadToken, isTokenExpired, getAccessToken } = require("./tokenManager");
const { handleWebhook } = require("./webhookController");
const { login, callback } = require("./authController");
const { getPositions } = require("./positionService");
const connectDB = require("./db");
const Trade = require("./models/Trade");
const { startTrading, stopTrading } = require("./control");
const { ensureLocalFile } = require("./instrumentStore");
const { startProfitBooking, stopProfitBooking, getMonitoringStatus, startCleanupTimer, stopCleanupTimer } = require("./profitBooking");

// ================= LOGIN =================
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.DASHBOARD_USER &&
    password === process.env.DASHBOARD_PASS
  ) {
    req.session.user = username;
    return res.json({
      success: true,
      redirect: "/"
    });
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

// ================= AUTH MIDDLEWARE =================
function isAuthenticated(req, res, next) {
  const publicRoutes = [
    "/login",
    "/login.html",
    "/login-upstox",
    "/callback",
    "/webhook"
  ];

  if (publicRoutes.includes(req.path)) return next();

  if (req.session.user) return next();

  return res.redirect("/login.html");
}

app.use(isAuthenticated);


// ================= ROUTES =================

// ✅ Allow dashboard page to load always
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// (optional but fine)
app.get("/index.html", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});


// UPSTOX LOGIN
app.get("/login-upstox", login);
app.get("/callback", callback);


//=================== Logout=======================
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");   // ✅ now this will work
  });
});


// ================= WEBHOOK =================
const recentTrades = new Map();

function isRecent(symbol) {
  const now = Date.now();
  if (recentTrades.has(symbol) && now - recentTrades.get(symbol) < 5000) {
    return true;
  }
  recentTrades.set(symbol, now);
  return false;
}

async function isDuplicateTrade(symbol) {
  try {
    const accessToken = getAccessToken();

    const res = await fetch("https://api.upstox.com/v2/portfolio/short-term-positions", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const positions = (await res.json()).data || [];

    return positions.some(p =>
      p.trading_symbol === symbol && p.quantity !== 0
    );

  } catch (err) {
    console.error(err);
    return false;
  }
}

app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;
    const symbol = data.symbol || data.TS;

    if (isRecent(symbol)) return res.send("Blocked");

    const duplicate = await isDuplicateTrade(symbol);
    if (duplicate) return res.send("Duplicate");

    await handleWebhook(req, res);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// ================= API ROUTES =================
app.get("/status", (req, res) => {
  res.json({
    server: "running",
    tokenExpired: isTokenExpired(),
    time: new Date()
  });
});

app.get("/positions", async (req, res) => {
  const positions = await getPositions();
  res.json(positions);
});

app.get("/trades", async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const trades = await Trade.find({
    time: { $gte: startOfDay }
  }).sort({ time: -1 });

  res.json(trades);
});

// ================= CONTROL =================
app.get("/start", (req, res) => {
  startTrading();
  res.send("Trading Started");
});

app.get("/stop", (req, res) => {
  stopTrading();
  res.send("Trading Stopped");
});

// ================= PROFIT BOOKING =================
app.get("/profit-booking/start", (req, res) => {
  const interval = req.query.interval || 5000; // Default 5 seconds
  startProfitBooking(Number(interval));
  res.json({
    status: "STARTED",
    message: `Profit booking started (checking every ${interval}ms)`
  });
});

app.get("/profit-booking/stop", (req, res) => {
  stopProfitBooking();
  res.json({
    status: "STOPPED",
    message: "Profit booking monitoring stopped"
  });
});

app.get("/profit-booking/status", (req, res) => {
  const status = getMonitoringStatus();
  res.json({
    isActive: status.isActive,
    activePositions: status.activePositions,
    positions: status.positions
  });
});

// ================= PROFILE =================
app.get("/profile", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ loggedIn: false });
    }

    const brokerProfile = await getProfile();
    const name =
      brokerProfile?.user_name ||
      brokerProfile?.userName ||
      brokerProfile?.name ||
      req.session.user;
    const clientId =
      brokerProfile?.user_id ||
      brokerProfile?.userId ||
      brokerProfile?.client_id ||
      brokerProfile?.clientId ||
      "N/A";

    return res.json({
      loggedIn: true,
      brokerConnected: Boolean(brokerProfile),
      name,
      clientId
    });

  } catch (err) {
    console.error("Profile error:", err);
    return res.json({
      loggedIn: Boolean(req.session.user),
      brokerConnected: false,
      name: req.session.user || "N/A",
      clientId: "N/A"
    });
  }
});

// ================= SOCKET =================
io.on("connection", (socket) => {
  console.log("Dashboard connected:", socket.id);
});

// ================= START SERVER =================
async function startServer() {
  await connectDB();
  loadToken();
  await ensureLocalFile();

  server.listen(3000, () => {
    console.log("Server running on port 3000");
  });

  setInterval(syncOrders, 2000);

  // ==============================
  // 🎯 START PROFIT BOOKING (Auto)
  // ==============================
  // Check positions every 5 seconds
  startProfitBooking(5000);
  console.log("✅ Profit booking service started automatically");

  // ==============================
  // 🧹 START CLEANUP TIMER
  // ==============================
  startCleanupTimer();
  console.log("✅ Memory cleanup timer started");
}

startServer();
