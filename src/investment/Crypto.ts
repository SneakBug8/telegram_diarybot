import axios from "axios";
import { shortNum, StringIncludes } from "../util/EqualString";

import * as level from "level";
import { Config } from "../config";
import { CryptoPair } from "./CryptoData";
import { Sleep } from "../util/Sleep";

// 1) Create our database, supply location and options.
//    This will create or open the underlying store.
const db = level(Config.dataPath() + "/crypto", { valueEncoding: "json" });

class CryptoClass
{
  public coinslist: Array<{ id: string, symbol: string, name: string }> = [];
  public async Init()
  {
    db.get("Pairs", (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        db.put("Pairs", []);
      }
    });
    db.get("usd", (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        db.put("usd", 0);
      }
    });
    db.get("totaltime", (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        db.put("totaltime", 0);
      }
    });
    db.get("totaltimes", (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        db.put("totaltimes", 0);
      }
    });
  }

  public async getCryptoChange()
  {
    const pairs = await this.getPairs();
    let res = "";

    let i = 0;
    for (const pair of pairs) {
      i++;
      if (i > 30) {
        await Sleep(1000);
        i = 0;
      }

      res += `${pair.coin}: ${await this.getCoinChange(pair.coin)}\n`;
    }
    return res;
  }

  public async getCryptoPortfolio()
  {
    const pairs = await this.getPairs();
    let res = "";

    let i = 0;

    let totalinvested = 0;
    let totalprice = 0;
    let totalprofit = 0;
    for (const pair of pairs) {
      i++;
      if (i > 30) {
        await Sleep(1000);
        i = 0;
      }

      if (!pair.volume) {
        continue;
      }

      const prices = await this.getCoinPrice(pair.coin);

      let change = (prices.current / pair.averageprice - 1) * 100;
      const mark = (change > 0) ? "+" : "-";
      change = Math.abs(change);
      const profit = (prices.current - pair.averageprice) * pair.volume;

      console.log(pair);

      res += `${pair.coin}: ${shortNum(pair.averageprice)} -> ${shortNum(prices.current)} ` +
        `(${mark}${shortNum(change)} %), ${shortNum(pair.volume)}ct, profit: ${shortNum(profit)}\n`;

      totalinvested += pair.averageprice * pair.volume;
      totalprice += prices.current * pair.volume;
      totalprofit += profit;
    }

    let totalchange = (totalprice / totalinvested - 1) * 100;
    const mark = (totalchange >= 0) ? "+" : "-";
    totalchange = Math.abs(totalchange);

    console.log(await this.getUSDBalance());

    res += `\n---\n` +
      `Total: ${shortNum(totalinvested)} -> ${shortNum(totalprice)} ` +
      `(${mark}${shortNum(totalchange)} %), profit ${shortNum(totalprofit)}\n` +
      `USD Balance: ${await this.getUSDBalance()}`;

    // await this.setUSDBalance(-totalinvested);

    return res;
  }

  public async getCoinChange(coinid: string)
  {
    try {
      const res = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${coinid}/market_chart`,
        { params: { vs_currency: "usd", days: 1, interval: "daily" } });

      const prev = res.data.prices[0][1];
      const curr = res.data.prices[1][1];

      let change = (curr / prev - 1) * 100;
      const mark = (change >= 0) ? "+" : "-";
      change = Math.abs(change);

      return `${shortNum(prev)} -> ${shortNum(curr)} (${mark}${shortNum(change)}%)`;
    }
    catch (e) {
      return e;
    }
  }

  public async getCoinPrice(coinid: string)
  {
    try {
      const res = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${coinid}/market_chart`,
        { params: { vs_currency: "usd", days: 1, interval: "daily" } });
      const previous = res.data.prices[0][1];
      const current = res.data.prices[1][1];

      return { current, previous };
    }
    catch (e) {
      return e;
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

    await this.setPairs(pairs);
    let usd = await this.getUSDBalance();
    usd -= amount * price;
    await this.setUSDBalance(usd);

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

    await this.setPairs(pairs);
    let usd = await this.getUSDBalance();
    usd += amount * price;
    await this.setUSDBalance(usd);

    return true;
  }

  public async getCoinsList()
  {
    const res = await axios.get(
      `https://api.coingecko.com/api/v3/coins/list`);

    this.coinslist = res.data;
  }

  private async getPairs()
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
