import TelegramBot = require("node-telegram-bot-api");
import { MessageWrapper } from "../MessageWrapper";

const timers = new Array<Date>();

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/timer startt" }, { text: "/timer stop" }, { text: "/timer clear" }],
    [{ text: "/exit" }],
  ];
}

function reply(msg: MessageWrapper, text: string)
{
  msg.reply(text, getKeyboard());
}

export async function ProcessTimer(message: MessageWrapper)
{
  if (message.checkRegex(/\/timer start/) || message.checkRegex(/\/timer add/)) {
    timers.push(new Date(Date.now()));

    return reply(message, `Created timer ${timers.length}.`);
  }
  if (message.checkRegex(/\/timer stop/)) {
    if (!timers.length) {
      return reply(message, "No timers running");
    }
    const timern = timers.length;
    const timer = timers.pop() as Date;

    return reply(message, `Stopped timer ${timern}.` +
      `Elapsed time - ${parseTime(Date.now() - timer.valueOf())}`);
  }
  if (message.checkRegex(/\/timer clear/)) {
    if (!timers.length) {
      return reply(message, "No timers running");
    }

    while (timers.length) {
      const timern = timers.length;
      const timer = timers.pop() as Date;

      reply(message, `Stopped timer ${timern}. ` +
        `Elapsed time - ${parseTime(Date.now() - timer.valueOf())}`);
    }
    return;
  }

  if (message.checkRegex(/\/timer/)) {
    return reply(message, `Timer module.`);
  }
  return false;
}

function parseTime(time: number)
{
  let res = "";
  if (time >= 1000 * 60 * 60 * 24) {
    res += `${Math.floor(time / 1000 / 60 / 60 / 24)}d`;
    time = time % (1000 * 60 * 60 * 24);
  }
  if (time >= 1000 * 60 * 60) {
    res += `${Math.floor(time / 1000 / 60 / 60)}h`;
    time = time % (1000 * 60 * 60);
  }
  if (time >= 1000 * 60) {
    res += `${Math.floor(time / 1000 / 60)}m`;
    time = time % (1000 * 60);
  }
  res += `${time / 1000}s`;
  return res;
}