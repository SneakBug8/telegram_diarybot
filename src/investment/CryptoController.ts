import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { Server, setWaitingForValue } from "..";
import TelegramBot = require("node-telegram-bot-api");
import { Crypto } from "./Crypto";
import { shortNum } from "../util/EqualString";
import { Sleep } from "../util/Sleep";

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/crypto prices" }, { text: "/crypto portfolio" }, { text: "/crypto notifications" }],
    [{ text: "/crypto add coin" }, { text: "/crypto remove coin" }],
    [{ text: "/crypto buy coin" }, { text: "/crypto sell coin" }],
    [{ text: "/exit" }],
  ];
}

function reply(msg: MessageWrapper, text: string)
{
  msg.reply(text, getKeyboard());
}

export async function InitCrypto()
{
  await Crypto.Init();
  setInterval(CryptoCycle, 15 * 60 * 1000);

  const pairs = await Crypto.getPairs();
  console.log(`[Crypto] Read ${pairs.length} crypto coins`);
}

const whattimeofaday = 18;
const curdate = new Date();
let lastSend = (curdate.getHours() < whattimeofaday) ? curdate.getDay() - 1 : curdate.getDay();

async function CryptoCycle()
{
  const now = new Date(Date.now());

  if (now.getHours() === whattimeofaday && now.getMinutes() <= 30 && lastSend !== now.getDay()) {
    console.log(now + " sending time");
    CryptoSend();
  }
}

async function CryptoSend()
{
  const now = new Date(Date.now());
  lastSend = now.getDay();

  await Crypto.createMarketChart();

  await Server.SendMessage(`Crypto porfolio\n` + await Crypto.getCryptoPortfolio(true));
}

export async function ProcessCrypto(message: MessageWrapper)
{
  if (message.checkRegex(/\/crypto portfolio/)) {
    reply(message, `Crypto porfolio\n` + await Crypto.getCryptoPortfolio());
    return;
  }
  if (message.checkRegex(/\/crypto chart/)) {
    await Crypto.createMarketChart();
    return;
  }
  /*
  Doesn't work
  if (message.checkRegex(/\/crypto list/)) {
    await Crypto.getCoinsList();
    const coins = Crypto.coinslist.map((x) => x.id);

    let res = "";

    reply(message, `All currencies\n`);

    for (const coin of coins) {
      if (res.length > 9500) {
        reply(message, res);
        res = "";
        await Sleep(1000);
      }
      res += coin + ", ";
    }

    return;
  }*/
  if (message.checkRegex(/\/crypto add coin/)) {
    setWaitingForValue(`Write name of the coin:`,
      async (msg) =>
      {
        const coin = msg.message.text;

        if (!coin) { return; }

        const res = await Crypto.addPair(coin);
        if (typeof res === "string") {
          reply(message, res);
        }
        else {
          reply(message, `Successfuly added coin ${coin}.`);
        }
      });
    return;
  }
  if (message.checkRegex(/\/crypto remove coin/)) {
    setWaitingForValue(`Write name of the coin:`,
      async (msg) =>
      {
        const coin = msg.message.text;

        if (!coin) { return; }

        const res = await Crypto.removePair(coin);
        if (typeof res === "string") {
          reply(message, res);
        }
        else {
          reply(message, `Successfuly removed coin ${coin}.`);
        }
      });
    return;
  }
  if (message.checkRegex(/\/crypto buy coin/)) {
    setWaitingForValue(`Write name of the coin:`,
      (msg) =>
      {
        const coin = msg.message.text;

        setWaitingForValue(`Price:`,
          (msg2) =>
          {
            const pricetext = msg2.message.text + "";
            const price = Number.parseFloat(pricetext);

            if (!price) {
              return reply(msg2, "Incorrect price");
            }

            setWaitingForValue(`Amount:`,
              async (msg3) =>
              {
                const amounttext = msg3.message.text + "";
                const amount = Number.parseFloat(amounttext);

                if (!amount) {
                  return reply(msg2, "Incorrect amount");
                }

                if (!coin) { return; }

                const res = await Crypto.buyPair(coin, amount, price);
                if (typeof res === "string") {
                  reply(message, res);
                }
                else {
                  reply(message, `Successfuly bought ${amount} ${coin} at ${price}. ` +
                    `Spent ${shortNum(amount * price)} USD.`);
                }
              });
          });
      });
    return;
  }
  if (message.checkRegex(/\/crypto sell coin/)) {
    setWaitingForValue(`Write name of the coin:`,
      (msg) =>
      {
        const coin = msg.message.text;

        setWaitingForValue(`Price:`,
          (msg2) =>
          {
            const pricetext = msg2.message.text + "";
            const price = Number.parseFloat(pricetext);

            if (!price) {
              return reply(msg2, "Incorrect price");
            }

            setWaitingForValue(`Amount:`,
              async (msg3) =>
              {
                const amounttext = msg3.message.text + "";
                const amount = Number.parseFloat(amounttext);

                if (!amount) {
                  return reply(msg2, "Incorrect amount");
                }

                if (!coin) { return; }

                const res = await Crypto.sellPair(coin, amount, price);
                if (typeof res === "string") {
                  reply(message, res);
                }
                else {
                  reply(message, `Successfuly sold ${amount} ${coin} at ${price}. ` +
                    `Added ${shortNum(amount * price)} USD.`);
                }
              });
          });
      });
    return;
  }
  if (message.checkRegex(/\/crypto prices/)) {
    reply(message, "Daily crypto change\n" + await Crypto.getCryptoChange());
    return;
  }
  if (message.checkRegex(/\/crypto$/)) {
    reply(message, "Crypto module");
    return;
  }

  return false;
}