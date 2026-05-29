# 🎯 Target Based Profit Booking - Setup & Usage Guide

## Overview

This algo now includes an **automatic target-based profit booking system** that:
- ✅ Monitors open positions tick-by-tick
- ✅ Automatically books profit when target is reached
- ✅ Supports configurable targets per instrument
- ✅ Logs all profit booking events
- ✅ Emits real-time updates to dashboard

---

## 📁 New Files Created

### 1. **targetConfig.js**
Define profit targets for each instrument/symbol.

**Location:** `./targetConfig.js`

**What it does:**
- Stores target points for each symbol
- Allows dynamic target updates
- Returns default target (50 points) if symbol not found

---

### 2. **profitBooking.js**
Main profit booking service that monitors and books profits.

**Location:** `./profitBooking.js`

**Key Functions:**
- `registerPosition(trade)` - Register a position for monitoring
- `checkAndBookProfits()` - Check all positions against current LTP
- `startProfitBooking(interval)` - Start the monitoring loop
- `stopProfitBooking()` - Stop the monitoring loop
- `getMonitoringStatus()` - Get current monitoring status
- `bookProfit(position)` - Place closing order when target is hit

---

## 🚀 How It Works

### Step 1: Define Targets
Edit `targetConfig.js` and set target points for each symbol:

```javascript
const TARGET_POINTS = {
  "BANKNIFTY": 50,    // 50 rupees profit target
  "NIFTY": 30,        // 30 rupees profit target
  "FINNIFTY": 40,
  "RELIANCE": 10,
};
```

**Tips:**
- Target is in RUPEES (e.g., 50 means 50 rupees profit)
- Works for BUY (entry + target) and SELL (entry - target)
- If symbol not found, defaults to 50 points

---

### Step 2: Order Placement
When an order is placed (via webhook or signal):

```
1. Order is sent to broker ✅
2. Trade record is created in DB
3. System waits for entry price to be available
4. Once entry price is set, position is registered for monitoring
5. Profit booking loop starts tracking LTP
```

---

### Step 3: Continuous Monitoring
The system checks every **5 seconds** (configurable):

```
For BUY position:
  Entry: 1000 | Target: 50 points | Target Price: 1050
  If LTP >= 1050 → Book Profit ✅

For SELL position:
  Entry: 1000 | Target: 50 points | Target Price: 950
  If LTP <= 950 → Book Profit ✅
```

---

### Step 4: Profit Booking
When target is hit:

```
1. Closing order is placed (SELL for BUY, BUY for SELL)
2. Position status is updated to "BOOKED"
3. Trade PnL is recorded
4. Dashboard receives real-time update
5. Position removed from monitoring
```

---

## 🔧 Configuration

### Default Target Settings (in targetConfig.js)

```javascript
const TARGET_POINTS = {
  "BANKNIFTY": 50,     // Edit this value
  "NIFTY": 30,
  "FINNIFTY": 40,
  // Add more symbols here
};
```

### Monitoring Interval (in server.js)

```javascript
// Start with 5 second interval (configurable)
startProfitBooking(5000);  // milliseconds
```

---

## 📡 API Endpoints

### 1. Start Profit Booking
```
GET /profit-booking/start?interval=5000

Response:
{
  "status": "STARTED",
  "message": "Profit booking started (checking every 5000ms)"
}
```

### 2. Stop Profit Booking
```
GET /profit-booking/stop

Response:
{
  "status": "STOPPED",
  "message": "Profit booking monitoring stopped"
}
```

### 3. Check Monitoring Status
```
GET /profit-booking/status

Response:
{
  "isActive": true,
  "activePositions": 2,
  "positions": [
    {
      "orderId": "12345",
      "instrument": "BANKNIFTY",
      "entryPrice": 50000,
      "targetPrice": 50050,
      "side": "BUY",
      "status": "MONITORING"
    }
  ]
}
```

---

## 🎯 Database Schema Changes

The `Trade` model now includes:

```javascript
{
  entry_price: Number,              // Entry price when position registered
  target_price: Number,             // Target price for profit booking
  target_points: Number,            // Points to profit (e.g., 50)
  exit_time: Date,                  // When profit was booked
  profit_booked: Boolean,           // Was profit auto-booked?
  profit_booking_status: String     // NOT_STARTED | MONITORING | BOOKED | FAILED
}
```

---

## 📊 Real-Time Dashboard Updates

The system emits socket events:

### When Position is Registered
```javascript
// Dashboard receives
{
  event: "position_registered",
  data: {
    orderId: "12345",
    instrument: "BANKNIFTY",
    entryPrice: 50000,
    targetPrice: 50050,
    points: 50
  }
}
```

### When Profit is Booked
```javascript
// Dashboard receives
{
  event: "profit_booked",
  data: {
    orderId: "12345",
    instrument: "BANKNIFTY",
    entryPrice: 50000,
    targetPrice: 50050,
    points: 50,
    side: "BUY",
    quantity: 1
  }
}
```

---

## 🛠️ Integration Flow

### Current Workflow:
```
Webhook Signal
     ↓
webhookController.js (handleWebhook)
     ↓
orderService.js (placeOrder)
     ↓
Trade created in DB
     ↓
profitBooking.js (registerPosition)
     ↓
profitBooking.js (checkAndBookProfits - every 5s)
     ↓
Target Hit? → Book Profit (place closing order)
```

---

## 📝 Example Trade Lifecycle

### Trade Log Entry:
```javascript
{
  _id: ObjectId,
  orderId: "12345",
  side: "BUY",
  instrument: "BANKNIFTY",
  quantity: 50,
  entry_price: 50000,      // Set when filled
  target_price: 50050,     // Calculated from config
  target_points: 50,       // From targetConfig.js
  status: "CLOSED",        // After booking
  profit_booked: true,     // Auto-booked
  exit_time: 2024-05-28T10:30:45Z,
  pnl: 50,                 // Profit points
  profit_booking_status: "BOOKED"
}
```

---

## ⚠️ Important Notes

1. **Entry Price Requirement**: Position is only registered when entry price is available (filled quantity > 0)

2. **Retry Logic**: If entry price isn't available immediately, system retries for up to 10 seconds

3. **Monitoring Frequency**: Default is 5 seconds - adjust in `server.js` if needed for faster/slower checks

4. **Manual Override**: You can manually stop profit booking via `/profit-booking/stop` if needed

5. **Error Handling**: If profit booking fails, position status is marked as "FAILED" and not retried

---

## 🐛 Troubleshooting

### Profit Not Booking
- Check if `profitBooking` is running: `GET /profit-booking/status`
- Verify target is set in `targetConfig.js` for that symbol
- Check if entry price is available in the trade record
- Review server logs for LTP fetch errors

### Entry Price Not Setting
- Ensure order is actually filled by broker
- Check `syncOrders` is running to update trade data
- Verify trade status in DB is "OPEN" or "PARTIAL"

### High Monitoring Latency
- Reduce interval in `startProfitBooking()` call
- Note: Minimum practical is ~1000ms due to API rate limits

---

## 📈 Performance Optimization

For handling many positions, consider:

1. **Batch LTP Fetching**: Modify `getLTP()` to fetch multiple instruments
2. **Position Grouping**: Monitor by symbol instead of individual positions
3. **Staggered Checks**: Spread checks across different positions

---

## 🔐 Security Notes

- Closing orders use MARKET order type (auto-execution)
- Quantity calculation ensures proper lot sizes
- Position ownership validated via orderId

---

## 📞 Support

For issues or questions about profit booking:
1. Check the API response in `/profit-booking/status`
2. Review server logs for detailed error messages
3. Verify targetConfig.js has the correct targets
4. Ensure broker connection and token validity

---

**Last Updated:** May 28, 2024
**Version:** 1.0
