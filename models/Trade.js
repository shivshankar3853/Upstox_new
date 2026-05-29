const mongoose = require("mongoose");

const tradeSchema = new mongoose.Schema({
  time: { type: Date, default: Date.now },

  side: String,
  instrument: String,

  quantity: Number,
  filled_qty: { type: Number, default: 0 },

  orderId: { type: String, index: true }, // broker order id

  price: Number,
  avg_price: { type: Number, default: 0 },
  trading_symbol: String,

  status: {
    type: String,
    enum: ["OPEN", "PARTIAL", "CLOSED", "CANCELLED", "FAILED"],
    default: "OPEN"
  },

  pnl: { type: Number, default: 0 },

  exchange: String,
  product: String,
  order_type: String,

  raw: Object, // full broker response

  // ================ TARGET BASED PROFIT BOOKING ================
  entry_price: { type: Number, default: 0 }, // Entry price (avg_price)
  target_price: { type: Number, default: 0 }, // Target price to book profit
  target_points: { type: Number, default: 0 }, // Profit points target
  exit_time: Date, // When profit was booked
  profit_booked: { type: Boolean, default: false }, // Whether profit was auto-booked
  profit_booking_status: {
    type: String,
    enum: ["NOT_STARTED", "MONITORING", "BOOKED", "FAILED"],
    default: "NOT_STARTED"
  }
}, { timestamps: true });

module.exports = mongoose.model("Trade", tradeSchema);
