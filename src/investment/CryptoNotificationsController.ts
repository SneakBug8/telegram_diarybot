import { MessageWrapper } from "../MessageWrapper";
import { Server, setWaitingForValue } from "..";
import TelegramBot = require("node-telegram-bot-api");
import { CryptoNotifications } from "./CryptoNotifications";

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/crypto notification up" }, { text: "/crypto notification down" }],
    [{ text: "/crypto notifications" }],
    [{ text: "/exit" }],
  ];
}

function reply(msg: MessageWrapper, text: string)
{
  msg.reply(text, getKeyboard());
}

export async function InitCryptoNotifications()
{
  await CryptoNotifications.Init();

  setInterval(CheckNotifications, 15 * 60 * 1000);

  const notifications = await CryptoNotifications.getNotifications();
  console.log(`[Crypto Notifications] Read ${notifications.length} crypto notifications`);
}

async function CheckNotifications()
{
  const notifications = await CryptoNotifications.checkNotifications();

  if (!notifications.length) {
    return;
  }

  await Server.SendMessage(`Crypto notifications\n` + notifications);
}

export async function ProcessCryptoNotifications(message: MessageWrapper)
{
  if (message.checkRegex(/\/crypto notification up/)) {
    setWaitingForValue(`Write name of the coin:`,
      (msg) =>
      {
        const coin = msg.message.text;

        setWaitingForValue(`Price:`,
          async (msg2) =>
          {
            const pricetext = msg2.message.text + "";
            const price = Number.parseFloat(pricetext);

            if (!price) {
              return reply(msg2, "Incorrect price");
            }

            if (!coin) { return; }

            const res = await CryptoNotifications.addNotification(coin, 0, price);
            if (typeof res === "string") {
              reply(message, res);
            }
            else {
              reply(message, `Successfuly created notification for ${coin} at ${price}.`);
            }
          });
      });
    return;
  }
  if (message.checkRegex(/\/crypto notification down/)) {
    setWaitingForValue(`Write name of the coin:`,
      (msg) =>
      {
        const coin = msg.message.text;

        setWaitingForValue(`Price:`,
          async (msg2) =>
          {
            const pricetext = msg2.message.text + "";
            const price = Number.parseFloat(pricetext);

            if (!price) {
              return reply(msg2, "Incorrect price");
            }

            if (!coin) { return; }

            const res = await CryptoNotifications.addNotification(coin, price, 0);
            if (typeof res === "string") {
              reply(message, res);
            }
            else {
              reply(message, `Successfuly created notification for ${coin} at ${price}.`);
            }
          });
      });
    return;
  }
  if (message.checkRegex(/\/crypto notification/) || message.checkRegex(/\/crypto notifications/)) {
    reply(message, "Crypto notifications\n" + await CryptoNotifications.getNotificationsList());
    return;
  }
  return false;
}
