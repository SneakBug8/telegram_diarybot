import axios from "axios";
import { shortNum, StringIncludes } from "../util/EqualString";

import * as level from "level";
import { Config } from "../config";
import { CryptoPair } from "./CryptoData";
import { Sleep } from "../util/Sleep";
import { CryptoNotification } from "./CryptoNotificationData";
import { Crypto } from "./Crypto";

const db = level(Config.dataPath() + "/cryptonotifications", { valueEncoding: "json" });

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

      if (notification.minprice && prices.current < notification.minprice) {
        res += `${notification.id}: ${notification.coin} dropped below ${notification.minprice} (current: ${prices.current}).\n`;
        // triggerednotifications.push(notification.id);
        notification.minprice *= 0.9;
        notification.maxprice *= 0.9;
      }
      else if (notification.maxprice && prices.current > notification.maxprice) {
        res += `${notification.id}: ${notification.coin} rose higher than ${notification.maxprice} (current: ${prices.current}).\n`;
        // triggerednotifications.push(notification.id);
        notification.maxprice *= 1.1;
        notification.minprice *= 1.1;
      }

    }

    const newnotifications = notifications.filter((x) => !triggerednotifications.includes(x.id));
    await this.setNotifications(newnotifications);

    let totaltriggered = await this.getTotalTriggered();
    totaltriggered += triggerednotifications.length;
    await this.setTotalTriggered(totaltriggered);

    return res;
  }

  public async addNotification(coinid: string, minprice: number, maxprice: number)
  {
    const notifications = await this.getNotifications();

    const existing = notifications.find((x) => x.coin === coinid);

    if (existing && minprice && !maxprice) {
      existing.minprice = minprice;
      await this.setNotifications(notifications);
      return true;
    }
    else if (existing && !minprice && maxprice) {
      existing.maxprice = maxprice;
      await this.setNotifications(notifications);
      return true;
    }

    const notification = new CryptoNotification();
    notification.id = await this.getNewId();
    notification.coin = coinid;
    notification.minprice = minprice;
    notification.maxprice = maxprice;

    notifications.push(notification);

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
      res += `${notification.id}: ${notification.coin} at ${notification.minprice} - ${notification.maxprice}\n`;
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
