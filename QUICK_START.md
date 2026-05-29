# 🎯 Profit Booking Quick Start

## 📋 What Was Added

### New Files
- ✅ `targetConfig.js` - Define profit targets per symbol
- ✅ `profitBooking.js` - Monitors positions and books profit automatically
- ✅ `PROFIT_BOOKING_GUIDE.md` - Full documentation

### Updated Files
- ✅ `models/Trade.js` - Added profit booking fields
- ✅ `orderService.js` - Integrated profit booking registration
- ✅ `server.js` - Added control endpoints and auto-start

---

## ⚡ Quick Setup (2 Minutes)

### Step 1: Set Your Targets
Open `targetConfig.js` and edit the target points:

```javascript
const TARGET_POINTS = {
  "BANKNIFTY": 50,    // 50 rupees = target
  "NIFTY": 30,
  "FINNIFTY": 40,
};
```

### Step 2: Server Starts Automatically
- Profit booking starts when server starts ✅
- Monitors every 5 seconds by default ✅
- No additional configuration needed ✅

### Step 3: Send Signals
- Send your trading signals as usual
- Profit booking happens automatically
- Check dashboard for real-time updates

---

## 🔍 Verify It's Working

### Check Status
```
GET http://localhost:3000/profit-booking/status
```

**Response should show:**
```json
{
  "isActive": true,
  "activePositions": 2,
  "positions": [...]
}
```

---

## 📊 How It Works

```
Order Placed
    ↓
Entry Price Set
    ↓
Position Registered (status: MONITORING)
    ↓
Every 5 seconds: Check LTP
    ↓
Target Hit?
    ├─ YES → Book Profit (place closing order) ✅
    └─ NO → Keep monitoring
```

---

## 📱 Key API Endpoints

```
Start:   GET /profit-booking/start?interval=5000
Stop:    GET /profit-booking/stop
Status:  GET /profit-booking/status
```

---

## 🎯 Target Points Logic

### BUY Position
```
Entry Price: 1000
Target Points: 50
Target Price: 1000 + 50 = 1050
Profit Booked When: LTP >= 1050
```

### SELL Position
```
Entry Price: 1000
Target Points: 50
Target Price: 1000 - 50 = 950
Profit Booked When: LTP <= 950
```

---

## 📈 Example Trade Flow

```
1. Signal: BUY BANKNIFTY 50 contracts at LTP
2. Order placed → avg_price = 50000
3. System detects entry, target = 50000 + 50 = 50050
4. Monitoring starts...
5. 10:30 AM - LTP ticks to 50050
6. ✅ PROFIT BOOKED! Closing order placed
7. Dashboard shows: Profit 50 points
```

---

## 🛑 Manual Control

### Start monitoring
```
curl "http://localhost:3000/profit-booking/start"
```

### Stop monitoring
```
curl "http://localhost:3000/profit-booking/stop"
```

### Check positions being monitored
```
curl "http://localhost:3000/profit-booking/status"
```

---

## ⚙️ Configuration Options

### Change Monitoring Speed (in server.js)
```javascript
// Default 5000ms = 5 seconds
// Lower = faster checking, higher API calls
startProfitBooking(5000);  // Edit this number
```

### Add More Targets (in targetConfig.js)
```javascript
"ICICI": 8,
"TCS": 20,
"RELIANCE": 10,
```

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Profit not booking | Check `/profit-booking/status` - ensure "isActive": true |
| Entry price showing 0 | Wait for order to fill, then sync (2-3 seconds) |
| Wrong target points | Edit `targetConfig.js` for that symbol |
| High latency | Reduce interval in `startProfitBooking()` |

---

## 📊 Dashboard Integration

The system emits socket events for real-time updates:

```javascript
// When profit is booked, dashboard receives:
{
  event: "profit_booked",
  orderId: "12345",
  instrument: "BANKNIFTY",
  entryPrice: 50000,
  targetPrice: 50050,
  points: 50
}
```

---

## ✅ Checklist

- [ ] Set targets in `targetConfig.js`
- [ ] Verify server starts without errors
- [ ] Check `/profit-booking/status` shows active
- [ ] Send a test signal
- [ ] Monitor dashboard for position registration
- [ ] Wait for target to hit and verify profit books

---

**You're all set! 🚀**

For detailed docs, see `PROFIT_BOOKING_GUIDE.md`
