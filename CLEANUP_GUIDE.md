# 🗑️ Cleanup Guide - Remove Unnecessary Files

## ❌ Files to DELETE (Not Used in Algo)

These files are not imported or used anywhere in the codebase and can be safely deleted:

### Unused Code Files:
```
1. generate-otp.js
2. generateToken.js
3. signalGuard.js
4. validator.js
5. tradeLogger.js
```

### Generated/Runtime Files:
```
6. token.json (generated at runtime, will be recreated)
```

### Security Risk:
```
7. Reena-key.pem (private key file - DO NOT commit to repo)
```

### Optional (Keep if you want git history):
```
8. .git/ (git history directory)
```

---

## ✅ Files to KEEP

### Core Trading Engine:
- `server.js` - Main server entry point
- `orderService.js` - Place orders with broker
- `webhookController.js` - Receive trading signals
- `profitBooking.js` - Auto profit booking at targets
- `syncService.js` - Sync orders with broker

### Configuration:
- `config.js` - App configuration
- `targetConfig.js` - Profit target configuration
- `tokenManager.js` - Token/auth management
- `db.js` - Database connection

### Utilities:
- `control.js` - Trading on/off control
- `instrumentStore.js` - Instrument lookup & caching
- `symbolDecoder.js` - Symbol parsing
- `syncInstruments.js` - Sync instruments from broker
- `authController.js` - Login/callback handlers
- `profileService.js` - User profile
- `positionService.js` - Get positions

### Database:
- `models/Trade.js` - Trade record schema

### Frontend:
- `public/` - Dashboard and UI files
- `public/index.html`
- `public/login.html`
- `public/js/dashboard.js`
- `public/js/login.js`

### Data:
- `data/instruments.csv` - Instrument master data

### Dependencies:
- `package.json` - NPM dependencies
- `package-lock.json` - Locked versions

### Documentation (Optional but useful):
- `PROFIT_BOOKING_GUIDE.md` - Feature documentation
- `QUICK_START.md` - Quick reference
- `CRASH_ANALYSIS.md` - Code analysis report
- `FIXES_APPLIED.md` - Applied fixes documentation
- `PRE_LIVE_CHECKLIST.md` - Pre-deployment checklist

### Temp files to ignore:
- `.env` - Environment variables (git ignored)
- `node_modules/` - Dependencies (git ignored)

---

## 📊 Cleanup Stats

**Before:**
- Total files: 40+

**After:** 
- Code files: 18 (essential)
- Public files: 4
- Data files: 1
- Config/model files: 6
- Documentation: 5 (optional)
- **Total: ~33 files** (25% reduction)

---

## 🔒 Security Notes

- ❌ Remove `Reena-key.pem` - This is a private key and should NEVER be in repo
- ⚠️ Ensure `.env` is in `.gitignore` (not committed)
- ✅ Add `token.json` to `.gitignore` (runtime generated)

---

## 🎯 How to Remove (Windows)

### Option 1: Manual Delete
```
1. Open c:\algo_projects\upstox_algo in File Explorer
2. Select these files:
   - generate-otp.js
   - generateToken.js
   - signalGuard.js
   - validator.js
   - tradeLogger.js
   - token.json
   - Reena-key.pem
3. Press Delete
```

### Option 2: PowerShell
```powershell
cd c:\algo_projects\upstox_algo
Remove-Item generate-otp.js, generateToken.js, signalGuard.js, validator.js, tradeLogger.js, token.json, Reena-key.pem -Force
```

### Option 3: Git
If using git:
```bash
git rm --cached Reena-key.pem token.json
git rm generate-otp.js generateToken.js signalGuard.js validator.js tradeLogger.js
git commit -m "Remove unnecessary files and security risk"
```

---

## ✅ Verification After Cleanup

After removing files, verify the server still starts:

```bash
npm install
node server.js
```

Should output:
```
🟢 PROFIT BOOKING STARTED
✅ Profit booking service started automatically
🧹 Position cleanup timer started
Server running on port 3000
```

---

## 📝 .gitignore Configuration

Add to `.gitignore`:
```
# Runtime generated files
token.json
trade_logs.json

# Environment
.env
.env.local

# Private keys
*.pem
*.key

# Node
node_modules/
.DS_Store

# IDE
.vscode/
.idea/
*.swp
```

---

**Status:** Ready for cleanup ✅
**Total savings:** ~60KB of unnecessary code
