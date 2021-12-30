import axios from "axios";
import { shortNum, StringIncludes } from "../util/EqualString";

import * as level from "level";
import { Config } from "../config";
import { CryptoPair } from "./CryptoData";
import { Sleep } from "../util/Sleep";
import { CryptoNotification } from "./CryptoNotificationData";
import { Crypto } from "./Crypto";

const db = level(Config.dataPath() + "/cryptonotifications", { valueEncoding: "json" });

const roundings = new Map<number, number>([
  [10, 0.1],
  [100, 1],
  [1000, 10],
  [10000, 100]
]);

function roundInt(n: number)
{
  for (const rounding of roundings) {
    if (n >= rounding[0] && n % rounding[1] > rounding[1] / 2) {
      return Math.floor(n / rounding[1]) * rounding[1];
    }
    else if (n >= rounding[0] && n % rounding[1] < rounding[1] / 2) {
      return Math.ceil(n / rounding[1]) * rounding[1];
    }
  }

  return n;
}

class CryptoNotificationsClass
{
  public coinslist: Array<{ id: string, symbol: string, name: string }> = [];
  public async Init()
  {
    await db.get("Notifications", async (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        await db.put("Notifications", []);
      }
    });
    await db.get("totaltriggered", async (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        await db.put("totaltriggered", 0);
      }
    });
    await db.get("lastid", async (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        await db.put("lastid", 0);
      }
    });

    // Notifications cleanup on restart
    const notifications = await this.getNotifications();
    const cleanupnotifications = notifications.filter((x) => x.minprice !== 0 || x.maxprice !== 0);
    await this.setNotifications(cleanupnotifications);
  }

  public async checkNotifications()
  {
    const notifications = await this.getNotifications();
    let res = "";

    const triggerednotifications: number[] = [];

    let i = 0;
    for (const notification of notifications) {
      i++;
      if (i > 30) {
        await Sleep(1000);
        i = 0;
      }

      const prices = await Crypto.getCoinPrice(notification.coin);

      if (notification.minprice && prices.current && prices.current < notification.minprice) {
        res += `${notification.id}: ${notification.coin} dropped below `
          + ` ${shortNum(notification.minprice)} (current: ${shortNum(prices.current)}).\n`;
        triggerednotifications.push(notification.id);
        // notification.minprice *= 0.9;
        // notification.maxprice *= 0.9;
        // notification.maxprice = roundInt(notification.maxprice);
        // notification.minprice = roundInt(notification.minprice);
      }
      else if (notification.maxprice && prices.current && prices.current > notification.maxprice) {
        res += `${notification.id}: ${notification.coin} rose higher than ` +
          `${shortNum(notification.maxprice)} (current: ${shortNum(prices.current)}).\n`;
        triggerednotifications.push(notification.id);
        // notification.maxprice *= 1.1;
        // notification.minprice *= 1.1;
        // notification.maxprice = roundInt(notification.maxprice);
        // notification.minprice = roundInt(notification.minprice);
      }
    }

    const newnotifications = notifications.filter((x) => !triggerednotifications.includes(x.id));
    await this.setNotifications(newnotifications);

    let totaltriggered = await this.getTotalTriggered();
    totaltriggered += triggerednotifications.length;
    await this.setTotalTriggered(totaltriggered);

    return res;
  }

  public async addNotification(coinid: string, minprice: number | undefined, maxprice: number | undefined)
  {
    const notifications = await this.getNotifications();

    const existing = notifications.find((x) => x.coin === coinid);

    if (existing && minprice !== undefined && !maxprice) {
      existing.minprice = minprice;
    }
    else if (existing && !minprice && maxprice !== undefined) {
      existing.maxprice = maxprice;
    }
    else if (!existing) {

      const notification = new CryptoNotification();
      notification.id = await this.getNewId();
      notification.coin = coinid;
      notification.minprice = minprice || 0;
      notification.maxprice = maxprice || 0;

      notifications.push(notification);
    }
    else {
      return "Incorrect input";
    }

    await this.setNotifications(notifications);
    return true;
  }
  public async removeNotification(id: number)
  {
    const notifications = await this.getNotifications();
    const notification = notifications.find((x) => x.id === id);

    if (!notification) {
      return "No such pair";
    }

    const newnotifications = notifications.filter((x) => x.id !== id);

    await this.setNotifications(newnotifications);
    return true;
  }

  public async getNotificationsList()
  {
    const notifications = await this.getNotifications();
    let res = "";

    for (const notification of notifications) {
      const count = await Crypto.getCount(notification.coin);
      res += `${notification.id}. ${notification.coin} (${shortNum(count)}) at ${shortNum(notification.minprice)}`
        + ` - ${shortNum(notification.maxprice)} \n`;
    }

    return res;
  }

  public async getCoinsList()
  {
    const res = await axios.get(
      `https://api.coingecko.com/api/v3/coins/list`);

    this.coinslist = res.data;
  }

  public async getNotifications()
  {
    return await db.get("Notifications") as CryptoNotification[];
  }
  private async setNotifications(notifications: CryptoNotification[])
  {
    notifications = notifications.sort((a, b) =>
    {
      if (a.minprice !== b.minprice) {
        return a.minprice - b.minprice;
      }
      return a.maxprice - b.maxprice;
    });

    await db.put("Notifications", notifications);
  }

  private async getNewId()
  {
    const nots = await this.getNotifications();
    for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
      if (!nots.find((x) => x.id === i)) {
        return i;
      }
    }
    return Math.round(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  private async getTotalTriggered()
  {
    return await db.get("lastid") as number;
  }
  private async setTotalTriggered(total: number)
  {
    await db.put("lastid", total);
  }
}

export const CryptoNotifications = new CryptoNotificationsClass();
