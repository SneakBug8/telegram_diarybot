import axios from "axios";
import { shortNum, StringIncludes } from "../util/EqualString";
import * as fs from "fs-extra";
import * as path from "path";

import * as level from "level";
import { Config } from "../config";
import { CryptoPair } from "./CryptoData";
import { Sleep } from "../util/Sleep";
import { Server } from "..";
import { BotAPI } from "../api/bot";
import dateFormat = require("dateformat");
import { Connection } from "../Database";

// 1) Create our database, supply location and options.
//    This will create or open the underlying store.
const db = level(Config.dataPath() + "/crypto", { valueEncoding: "json" });

export const CryptoTransactionsRepository = () => Connection("InvestmentsTransactions");
export const CryptoPortfolioRepository = () => Connection("CryptoPortfolio");

let marketHistoryData = new Array<
  { date: number, cap: number, volume: number, liquidity: number, btcDominance: number }>();

const roundings = new Map<number, string>([
  [1000 * 1000 * 1000, "B"],
  [1000 * 1000, "M"]
]);

function roundInt(n: number)
{
  for (const rounding of roundings) {
    if (n >= rounding[0]) {
      return (n / rounding[0]).toFixed(2) + rounding[1];
    }
  }

  return n;
}

class CryptoClass
{
  public coinslist: Array<{ id: string, symbol: string, name: string }> = [];
  public coinPricesCache = new Map<string, { current: number, previous: number, fetched: Date }>();

  public async Init()
  {
    db.get("Pairs", async (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        await db.put("Pairs", []);
      }
    });
    await db.get("usd", async (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        await db.put("usd", 0);
      }
    });
    await db.get("maxcapital", async (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        await db.put("maxcapital", 0);
      }
    });
    await db.get("rotated", async (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        await db.put("rotated", 0);
      }
    });
    await db.get("totaltime", async (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        await db.put("totaltime", 0);
      }
    });
    await db.get("totaltimes", async (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        await db.put("totaltimes", 0);
      }
    });

  }

  public async getCryptoChange()
  {
    const pairs = await this.getPairs();
    let res = "";

    const arr = [];

    let i = 0;
    for (const pair of pairs) {
      i++;
      if (i > 30) {
        await Sleep(1000);
        i = 0;
      }

      const change = await this.getCoinChange(pair.coin);

      arr.push({ pair, change });
    }

    arr.sort((x, y) => ((y.change.mark === "+") ? 1 : -1) * y.change.change -
      ((x.change.mark === "+") ? 1 : -1) * x.change.change);

    for (const a of arr) {
      res += `${a.pair.coin}: ${shortNum(a.change.previous)} -> ${shortNum(a.change.current)}` +
        ` (${a.change.mark}${shortNum(a.change.change)}%) (${a.pair.volume} ct) \n`;
    }

    return res;
  }

  public async getCryptoPortfolio(writeentry: boolean = false)
  {
    const pairs = await this.getPairs();
    let res = "";

    let i = 0;

    let totalinvested = 0;
    let totalprice = 0;
    let totalprofit = 0;

    const arr = [];

    for (const pair of pairs) {
      i++;
      if (i > 30) {
        await Sleep(1000);
        i = 0;
      }

      if (!pair.volume) {
        continue;
      }

      const price = await this.getCoinPrice(pair.coin);

      let change = (price.current / pair.averageprice - 1) * 100;
      const mark = (change > 0) ? "+" : "-";
      change = Math.abs(change);
      const profit = (price.current - pair.averageprice) * pair.volume;

      arr.push({ pair, price, mark, change, profit });

      totalinvested += pair.averageprice * pair.volume;
      totalprice += price.current * pair.volume;
      totalprofit += profit;
    }

    const capital = await this.getMaxCapital();
    if (totalinvested > capital) {
      await this.setMaxCapital(totalinvested);
    }

    arr.sort((x, y) => ((y.mark === "+") ? 1 : -1) * y.change -
      ((x.mark === "+") ? 1 : -1) * x.change);

    for (const a of arr) {
      res += `${a.pair.coin}: ${shortNum(a.pair.averageprice)} -> ${shortNum(a.price.current)} ` +
        `(${a.mark}${shortNum(a.change)} %), ${shortNum(a.pair.volume)}ct, profit: ${shortNum(a.profit)}\n`;
    }

    let totalchange = (totalprice / totalinvested - 1) * 100;
    const mark = (totalchange >= 0) ? "+" : "-";
    totalchange = Math.abs(totalchange);

    let fixeddiff = totalinvested + await this.getUSDBalance();
    const diffmark = (fixeddiff >= 0) ? "+" : "-";
    fixeddiff = Math.abs(fixeddiff);

    res += `\n---\n` +
      `Total: ${shortNum(totalinvested)} -> ${shortNum(totalprice)} ` +
      `(${mark}${shortNum(totalchange)}%), profit ${shortNum(totalprofit)}\n` +
      `USD Balance: ${shortNum(await this.getUSDBalance())} (${diffmark}${shortNum(fixeddiff)})\n` +
      `Rotated: ${shortNum(await this.getUSDRotated())}, Max capital: ${shortNum(await this.getMaxCapital())}`;

    // await this.setUSDBalance(-totalinvested);

    if (writeentry) {
      await this.writePortfolio(totalprice, totalinvested, await this.getUSDBalance(),
        fixeddiff, await this.getUSDRotated(), await this.getMaxCapital());
    }

    return res;
  }

  public async getCoinChange(coinid: string)
  {
    try {
      const { current, previous } = await this.getCoinPrice(coinid);
      let change = (current / previous - 1) * 100;
      const mark = (change >= 0) ? "+" : "-";
      change = Math.abs(change);

      return { previous, current, mark, change };

      // return `${shortNum(previous)} -> ${shortNum(current)} (${mark}${shortNum(change)}%)`;
    }
    catch (e) {
      console.error(e);
      return { previus: 0, current: 0, change: 0, mark: "+" };
    }
  }

  public async getCoinPrice(coinid: string)
  {
    try {
      if (this.coinPricesCache.get(coinid)) {
        const cached = this.coinPricesCache.get(coinid) as { current: number, previous: number, fetched: Date };
        if (Math.abs(cached.fetched.getTime() - Date.now()) < 5 * 60 * 1000 && cached.current) {
          return cached;
        }
      }
      const res = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${coinid}/market_chart`,
        { params: { vs_currency: "usd", days: 1, interval: "daily" } });
      const previous = res.data.prices[0][1];
      const current = res.data.prices[1][1];

      this.coinPricesCache.set(coinid, {
        current, previous, fetched: new Date()
      });

      return { current, previous };
    }
    catch (e) {
      console.error(e);
      return { current: 0, previous: 0 };
    }
  }

  public async createMarketChart()
  {
    try {
      await this.getMarketHistory();

      const labels = marketHistoryData.map((x) => dateFormat(new Date(x.date), "dd.mm.yyyy"));
      const cap = marketHistoryData.map((x) => x.cap / 1000 / 1000 / 1000);
      // const volume = marketHistoryData.map((x) => x.volume / 1000 / 1000 / 1000);
      // const liquidity = marketHistoryData.map((x) => x.liquidity / 1000 / 1000 / 1000);

      const res = await axios.post("https://quickchart.io/chart/create",
        {
          backgroundColor: "transparent",
          width: 800,
          height: 400,
          format: "png",
          chart: {
            type: "line", data: {
              labels,
              datasets: [{ label: "Capitalization (B)", data: cap },
              ]
            }
          }
        });

      const imageurl = res.data.url;

      await this.downloadChart(imageurl, "capitalization.png");

      const imagepath = path.resolve(Config.dataPath(), "capitalization.png");

      BotAPI.sendPhoto(Config.DefaultChat, fs.createReadStream(imagepath), {
        disable_notification: true
      });
    }
    catch (e) {
      Server.SendMessage(e + "");
    }
  }

  public async downloadChart(url: string, name: string)
  {
    const imagepath = path.resolve(Config.dataPath(), name);
    const writer = fs.createWriteStream(imagepath);

    const response = await axios.get(url, {
      responseType: "stream"
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) =>
    {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  }

  public async getMarketHistory()
  {
    try {
      const res = await axios.post(
        `https://api.livecoinwatch.com/overview/history`,
        { currency: "USD", start: Date.now() - 1000 * 60 * 60 * 24 * 180, end: Date.now() },
        {
          headers: { "x-api-key": process.env.livecoinwatchapi },
        });

      marketHistoryData = res.data;

      return marketHistoryData;
    }
    catch (e) {
      console.error(e);
      return [];
    }
  }

  public async getBitcoinChange()
  {
    return this.getCoinChange("bitcoin");
  }

  public async addPair(coinid: string)
  {

    if (!this.coinslist.length) {
      await this.getCoinsList();
    }

    const pairs = await this.getPairs();

    const existingpair = pairs.find((x) => StringIncludes(x.coin, coinid));
    if (existingpair) {
      return "Such pair already exists";
    }

    if (!this.coinslist.find((x) => StringIncludes(x.id, coinid))) {
      return "No such coin";
    }

    const pair = new CryptoPair();
    pair.coin = coinid;

    pairs.push(pair);
    await this.setPairs(pairs);
    return true;
  }

  public async removePair(coinid: string)
  {
    let pairs = await this.getPairs();

    const suitablepairs = pairs.filter((x) => StringIncludes(x.coin, coinid));
    if (suitablepairs.length > 1) {
      return "More than one pair";
    }

    pairs = pairs.filter((x) => !StringIncludes(x.coin, coinid));
    await this.setPairs(pairs);
    return true;
  }

  public async buyPair(coinid: string, amount: number, price: number)
  {
    const pairs = await this.getPairs();
    const pair = pairs.find((x) => StringIncludes(x.coin, coinid));

    if (!pair) {
      return "No such pair";
    }

    pair.averageprice = (pair.averageprice * pair.volume + price * amount) / (pair.volume + amount);
    pair.volume += amount;

    pairs.sort((x, y) => y.volume - x.volume);

    await this.setPairs(pairs);
    let usd = await this.getUSDBalance();
    usd -= amount * price;
    await this.setUSDBalance(usd);

    await this.setUSDRotated(await this.getUSDRotated() + amount * price);
    await this.writeTransaction(coinid, 0, price, amount);

    return true;
  }
  public async sellPair(coinid: string, amount: number, price: number)
  {
    const pairs = await this.getPairs();
    const pair = pairs.find((x) => StringIncludes(x.coin, coinid));

    if (!pair) {
      return "No such pair";
    }
    if (pair.volume < amount) {
      return "Not enough coins to sell";
    }

    pair.volume -= amount;
    pairs.sort((x, y) => y.volume - x.volume);

    await this.setPairs(pairs);
    let usd = await this.getUSDBalance();
    usd += amount * price;
    await this.setUSDBalance(usd);
    await this.writeTransaction(coinid, 1, price, amount);

    return true;
  }

  public async getCoinsList()
  {
    const res = await axios.get(
      `https://api.coingecko.com/api/v3/coins/list`);

    this.coinslist = res.data;
  }

  public async getCount(coin: string)
  {
    const pairs = await this.getPairs();
    const pair = pairs.find((x) => x.coin === coin);

    if (!pair) { return 0; }

    return pair.volume;
  }

  public async getPairs()
  {
    return await db.get("Pairs") as CryptoPair[];
  }
  private async setPairs(pairs: CryptoPair[])
  {
    await db.put("Pairs", pairs);
  }

  private async getUSDBalance()
  {
    return await db.get("usd") as number;
  }
  private async setUSDBalance(value: number)
  {
    await db.put("usd", value);
  }

  private async getUSDRotated()
  {
    return await db.get("rotated") as number || 0;
  }
  private async setUSDRotated(value: number)
  {
    await db.put("rotated", value);
  }

  private async getMaxCapital()
  {
    return await db.get("maxcapital") as number || 0;
  }
  private async setMaxCapital(value: number)
  {
    await db.put("maxcapital", value);
  }

  private async writeTransaction(pair: string, type: number, price: number, volume: number)
  {
    const r = {
      Pair: pair,
      Type: type,
      Price: price,
      Volume: volume,
      MIS_DT: Date.now()
    };
    CryptoTransactionsRepository().insert(r);
  }

  private async writePortfolio(assetsprice: number, invested: number,
    balance: number, realizedgain: number, rotated: number, maxcapital: number)
  {
    const r = {
      assetsprice,
      invested,
      balance,
      realizedgain,
      rotated,
      maxcapital,
      MIS_DT: Date.now()
    };
    CryptoTransactionsRepository().insert(r);
  }

  private async incrementTimeSpent(value: number)
  {
    let total = await db.get("totaltime") as number;
    total += value;
    let count = await db.get("totaltimes") as number;
    count++;

    await db.put("totaltime", total);
    await db.put("totaltimes", count);
  }

}

export const Crypto = new CryptoClass();