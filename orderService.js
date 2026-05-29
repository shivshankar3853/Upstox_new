const axios = require("axios");
const { getAccessToken } = require("./tokenManager");
const Trade = require("./models/Trade");

const { findInstrument } = require("./instrumentStore");
const { decodeSymbol } = require("./symbolDecoder");
const { registerPosition } = require("./profitBooking");
const { syncSpecificOrder } = require("./syncService");

// ==============================
// 🚀 PLACE ORDER (MCX_FO + LOT SIZE)
// ==============================
async function placeOrder(order) {
  try {
    const token = getAccessToken();
    
    if (!token) {
      throw new Error("❌ No access token available");
    }

    const action = (order.transaction_type || "").trim().toUpperCase();
    const quantity = Number(order.quantity);
    const rawSymbol = order.TS;

    if (!["BUY", "SELL"].includes(action)) {
      throw new Error("Invalid Action");
    }

    // ✅ QUANTITY VALIDATION (CRITICAL)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Invalid quantity: ${quantity}. Must be positive number`);
    }

    if (!rawSymbol) {
      throw new Error("Symbol missing");
    }

    // ==============================
    // 🧠 STEP 1: DECODE SYMBOL
    // ==============================
    const decoded = decodeSymbol(rawSymbol);
    console.log("🧠 Decoded:", decoded);

    let instrumentKey = null;
    let instrumentData = null;
    let exchange = decoded.exchange;

    const resolveInstrument = (res) => {
      if (!res) return null;
      if (typeof res === "object") {
        instrumentData = res;
        return res.instrument_token;
      } else {
        instrumentData = null;
        return res;
      }
    };

    // ==============================
    // 🔍 STEP 2: FIND INSTRUMENT
    // ==============================
    if (decoded.instrumentType === "EQ") {
      const formats = [`${decoded.symbol} EQ`, `${decoded.symbol}`];

      for (const f of formats) {
        const res = findInstrument(f);
        instrumentKey = resolveInstrument(res);
        if (instrumentKey) break;
      }

      exchange = decoded.exchange || "NSE";
    }

    else if (decoded.instrumentType === "FUT") {
      const formats = [
        `${decoded.symbol} FUT ${decoded.day} ${decoded.month} ${decoded.year}`,
        `${decoded.symbol} ${decoded.month} ${decoded.year} FUT`,
        `${decoded.symbol} FUT`
      ];

      for (const f of formats) {
        const res = findInstrument(f);
        instrumentKey = resolveInstrument(res);
        if (instrumentKey) break;
      }
    }

    else if (decoded.instrumentType === "OPT") {
      const shortYear = decoded.year.slice(-2);

      const formats = [
        `${decoded.symbol} ${decoded.strike} ${decoded.optionType} ${decoded.day} ${decoded.month} ${shortYear}`,
        `${decoded.symbol} ${decoded.day} ${decoded.month} ${shortYear} ${decoded.optionType} ${decoded.strike}`
      ];

      for (const f of formats) {
        const res = findInstrument(f);
        instrumentKey = resolveInstrument(res);
        if (instrumentKey) break;
      }
    }

    if (!instrumentKey) {
      throw new Error("Instrument not found: " + rawSymbol);
    }

    // ==============================
    // 🔥 LOT SIZE
    // ==============================
    const lotSize =
      instrumentData && instrumentData.lot_size
        ? Number(instrumentData.lot_size)
        : 1;

    const finalQty = quantity * lotSize;

    console.log(
      `📦 Lot Size: ${lotSize} | Input Qty: ${quantity} | Final Qty: ${finalQty}`
    );

    console.log("🎯 Matched:", instrumentKey, "| Exchange:", exchange);

    // ==============================
    // 🚀 STEP 3: BUILD PAYLOAD
    // ==============================
    const orderPayload = {
      quantity: finalQty,
      product: order.product === "NRML" ? "D" : "I",
      validity: order.validity || "DAY",
      price: 0,

      instrument_token: instrumentKey,
      exchange: exchange,

      order_type: order.order_type || "MARKET",
      transaction_type: action,

      disclosed_quantity: 0,
      trigger_price: 0,
      is_amo: false
    };

    console.log("📡 Sending:", orderPayload);

    // ==============================
    // 📤 STEP 4: API CALL (WITH TIMEOUT)
    // ==============================
    const response = await axios.post(
      "https://api.upstox.com/v2/order/place",
      orderPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );

    const orderData = response.data;
    const orderId = orderData.data?.order_id || "NA";
    const initialAvgPrice =
      orderData?.data?.average_price ||
      orderData?.data?.avg_price ||
      orderData?.average_price ||
      orderData?.avg_price ||
      orderData?.data?.price ||
      orderData?.price ||
      0;
    const initialPrice =
      orderData?.data?.price ||
      orderData?.price ||
      orderData?.data?.average_price ||
      orderData?.average_price ||
      0;

    console.log("✅ Order Success:", orderData);

    // ==============================
    // 🧾 STEP 5: SAVE TRADE (IMPORTANT CHANGE)
    // ==============================
    const trade = await Trade.create({
      side: action,                 // BUY or SELL
      quantity: finalQty,
      instrument: instrumentKey,
      trading_symbol: decoded.tradingSymbol || rawSymbol,
      exchange,

      orderId: orderId,

      price: initialPrice,
      avg_price: initialAvgPrice,
      entry_price: initialAvgPrice || initialPrice,
      filled_qty: 0,

      status: "OPEN",              // ALWAYS OPEN initially

      order_type: order.order_type,
      product: order.product,

      raw: orderData,
      time: new Date(),
      profit_booking_status: "NOT_STARTED"
    });

    // ==============================
    // 🎯 STEP 6: REGISTER FOR PROFIT BOOKING
    // ==============================
    // Sync the specific order first to get fill data, then register
    const maxRetries = 10;
    let retryCount = 0;
    
    const attemptRegistration = async () => {
      retryCount++;
      
      // First, sync the order with broker to get avg_price
      const syncedTrade = await syncSpecificOrder(orderId);
      
      if (syncedTrade && (syncedTrade.avg_price > 0 || syncedTrade.price > 0)) {
        // Entry price is available, register for profit booking
        syncedTrade.profit_booking_status = "MONITORING";
        await syncedTrade.save();
        registerPosition(syncedTrade);
        console.log("✅ Position registered for profit booking");
      } else if (retryCount < maxRetries) {
        // Retry after 2 seconds
        setTimeout(attemptRegistration, 2000);
      } else {
        console.log("⚠️  Max retries reached for profit booking registration. Synced Trade:", syncedTrade ? `avg_price=${syncedTrade.avg_price}, status=${syncedTrade.status}` : "null");
      }
    };

    // Start registration attempt (don't await to avoid blocking)
    attemptRegistration().catch(err => 
      console.error("❌ Error in profit booking registration:", err.message)
    );

    // ==============================
    // 📡 PUSH TO FRONTEND
    // ==============================
    if (global.io) {
      global.io.emit("order_update", { orderId });
    }

    return orderData;

  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
    throw err;
  }
}

// ==============================
// 📊 TRADE LOG
// ==============================
async function getTradeLog() {
  return await Trade.find().sort({ createdAt: -1 });
}

// ==============================
module.exports = {
  placeOrder,
  getTradeLog
};	
