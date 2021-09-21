import axios from "axios";
import { shortNum, StringIncludes } from "../util/EqualString";

import * as level from "level";
import { Config } from "../config";
import { CryptoPair } from "./CryptoData";
import { Sleep } from "../util/Sleep";
import { CryptoNotification } from "./NotificationsData";

const db = level(Config.dataPath() + "/cryptonotifications", { valueEncoding: "json" });

class CryptoNotificationsClass
{
  public coinslist: Array<{ id: string, symbol: string, name: string }> = [];
  public async Init()
  {
    db.get("Notifications", (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        db.put("Notifications", []);
      }
    });
    db.get("totaltriggered", (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        db.put("totaltriggered", 0);
      }
    });
    db.get("lastid", (err, value) =>
    {
      if (err?.name === "NotFoundError") {
        db.put("lastid", 0);
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

      const prices = await this.getCoinPrice(notification.coin);

      if (notification.minprice && prices.current < notification.minprice) {
        res += `${notification.id}: ${notification.coin} dropped below ${notification.minprice}.\n`;
        triggerednotifications.push(notification.id);
      }
      else if (notification.maxprice && prices.current > notification.maxprice) {
        res += `${notification.id}: ${notification.coin} rose higher than ${notification.maxprice}.\n`;
        triggerednotifications.push(notification.id);
      }

    }

    const newnotifications = notifications.filter((x) => !triggerednotifications.includes(x.id));
    await this.setNotifications(newnotifications);

    let totaltriggered = await this.getTotalTriggered();
    totaltriggered += triggerednotifications.length;
    await this.setTotalTriggered(totaltriggered);

    return res;
  }

  public async getCoinPrice(coinid: string)
  {
    try {
      const res = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${coinid}/market_chart`,
        { params: { vs_currency: "usd", days: 1, interval: "daily" } });
      const previous = res.data.prices[0][1] as number;
      const current = res.data.prices[1][1] as number;

      return { current, previous };
    }
    catch (e) {
      console.error(e);
      return { current: 0, previous: 0 };
    }
  }

  public async addNotification(coinid: string, minprice: number, maxprice: number)
  {
    const notifications = await this.getNotifications();

    const notification = new CryptoNotification();
    notification.id = await this.getLastId() + 1;
    notification.coin = coinid;
    notification.minprice = minprice;
    notification.maxprice = maxprice;

    notifications.push(notification);

    await this.setNotifications(notifications);
    await this.setLastId(notification.id);

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
      res += `${notification.id}: ${notification.coin} at ${notification.minprice}-${notification.maxprice}`;
    }

    return res;
  }

  public async getCoinsList()
  {
    const res = await axios.get(
      `https://api.coingecko.com/api/v3/coins/list`);

    this.coinslist = res.data;
  }

  private async getNotifications()
  {
    return await db.get("Notifications") as CryptoNotification[];
  }
  private async setNotifications(notifications: CryptoNotification[])
  {
    await db.put("Notifications", notifications);
  }

  private async getLastId()
  {
    return await db.get("lastid") as number;
  }
  private async setLastId(lastid: number)
  {
    await db.put("lastid", lastid);
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
