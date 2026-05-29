const axios = require("axios");
const Trade = require("./models/Trade");
const { getAccessToken } = require("./tokenManager");
const { findInstrument } = require("./instrumentStore");

async function getPositions() {
  try {
    const token = getAccessToken();

    const res = await axios.get(
      "https://api.upstox.com/v2/portfolio/short-term-positions",
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const positions = res.data.data || [];

    const openTrades = await Trade.find(
      {
        status: { $in: ["OPEN", "PARTIAL"] },
        quantity: { $ne: 0 }
      },
      { instrument: 1, trading_symbol: 1, entry_price: 1, target_price: 1 }
    );

    const positionMapByToken = new Map();
    const positionMapBySymbol = new Map();

    openTrades.forEach(trade => {
      const data = {
        entry_price: trade.entry_price || 0,
        target_price: trade.target_price || 0
      };

      if (trade.instrument) {
        positionMapByToken.set(trade.instrument, data);
      }

      if (trade.trading_symbol) {
        positionMapBySymbol.set(trade.trading_symbol.toUpperCase(), data);
      }
    });

    return positions.map(position => {
      const token = findInstrument(position.trading_symbol)?.instrument_token;
      const tradePosition =
        positionMapByToken.get(token) ||
        positionMapBySymbol.get(position.trading_symbol?.toUpperCase());
      const entryPrice = tradePosition?.entry_price;
      const targetPrice = tradePosition?.target_price;

      if (entryPrice > 0) {
        position.entry_price = entryPrice;
        if (!position.average_price || position.average_price === 0) {
          position.average_price = entryPrice;
        }
      }

      if (targetPrice > 0) {
        position.target_price = targetPrice;
      }

      return position;
    });

  } catch (err) {
    console.error("❌ Position Error:", err.response?.data);
    return [];
  }
}

module.exports = { getPositions };