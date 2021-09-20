import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { Server, setWaitingForValue } from "..";
import { InvestmentData } from "./InvestmentData";
import TelegramBot = require("node-telegram-bot-api");
import { shortNum } from "../util/EqualString";

let data = new InvestmentData();

const datafilepath = path.resolve(Config.dataPath(), "investment.json");
const whattimeofaday = 18;

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/investment in" }, { text: "/investment stats" }],
    [{ text: "/investment set target percentage" }],
    [{ text: "/investment set investment per day" }],
    [{ text: "/exit" }],
  ];
}

function reply(msg: MessageWrapper, text: string)
{
  msg.reply(text, getKeyboard());
}

export async function InitInvestment()
{
  if (fs.existsSync(datafilepath)) {
    const file = fs.readFileSync(datafilepath);

    data = JSON.parse(file.toString()) as InvestmentData;
    data.balance = data.balance || 0;
    data.delta = data.delta || 0;
    data.investperday = data.investperday || 0;
    data.targetpercentage = data.targetpercentage || 0;
    data.profit = data.profit || 0;
    data.lastdaychange = data.lastdaychange || 0;

    console.log(`Read investment data.`);
  }
  else {
    console.log(`Created new datafile for networking.`);
    InvestmentSave();
  }

  setInterval(InvestmentCycle, 15 * 60 * 1000);
}

export async function InvestmentSave()
{
  const tdata = JSON.stringify(data);
  fs.writeFileSync(datafilepath, tdata);
}

async function InvestmentCycle()
{
  const now = new Date(Date.now());

  if (now.getHours() === whattimeofaday && now.getMinutes() <= 30 && data.lastSend !== now.getDay()) {
    console.log(now + " sending time");
    InvestmentSend();
  }
}

async function InvestmentSend()
{
  const now = new Date(Date.now());
  data.lastSend = now.getDay();

  data.delta += data.investperday;

  const prevprofit = data.profit;

  data.profit += data.balance * data.targetpercentage / 100 / 365;
  data.balance *= 1 + (data.targetpercentage / 100 / 365);
  data.days++;
  data.lastdaychange = data.profit - prevprofit;

  if (data.delta >= 0) {
    await Server.SendMessage(`Время инвестировать!\n` + ShortStatistics());
  } else {
    await Server.SendMessage(`Текущая статистика по инвестициям.\n` + ShortStatistics());
  }

  InvestmentSave();
}

function ShortStatistics()
{
  let res = "";

  if (data.delta >= 0) {
    res += `Необходимо довложить: ${data.delta}\n`;
  }
  else {
    res += `Необходимо вложить через ${Math.round(-data.delta / data.investperday)} дней\n`;
  }
  return res +
    `Цель: ${data.investperday} в день, ${data.targetpercentage}% годовых\n` +
    `Ты уже скопил: ${Math.round(data.balance)}. Прибыль: ${data.profit.toFixed(2)}` +
    ` (${data.lastdaychange.toFixed(2)}).`;
}

function FullStatistics()
{
  return ShortStatistics() +
    `\nAverage profit per day: ${shortNum(data.profit / data.days)}`;
}

export async function ProcessInvestments(message: MessageWrapper)
{
  if (message.checkRegex(/\/investment in/)) {
    setWaitingForValue(`Please, write amount of investment:`,
      (msg) =>
      {
        const amttext = msg.message.text;
        const amt = Number.parseFloat(amttext + "");

        if (!amttext || !amt) { return; }

        data.delta -= amt;
        data.balance += amt;
        InvestmentSave();

        reply(message, `Invested ${amt}.`);
      });
    return;
  }
  if (message.checkRegex(/\/investment set target percentage/)) {
    setWaitingForValue(`Please, write new target percentage:`,
      (msg) =>
      {
        const amttext = msg.message.text;
        const amt = Number.parseFloat(amttext + "");

        if (!amttext || !amt) { return; }

        data.targetpercentage = amt;
        InvestmentSave();

        reply(message, `New target percentage is ${amt}.`);
      });
    return;
  }
  if (message.checkRegex(/\/investment set investment per day/)) {
    setWaitingForValue(`Please, write new target investment per day:`,
      (msg) =>
      {
        const amttext = msg.message.text;
        const amt = Number.parseFloat(amttext + "");

        if (!amttext || !amt) { return; }

        data.investperday = amt;
        InvestmentSave();

        reply(message, `New target investment per day is ${amt}.`);
      });
    return;
  }
  if (message.checkRegex(/\/investment stats/)) {
    reply(message, FullStatistics());

    return;
  }
  if (message.checkRegex(/\/investment/)) {
    reply(message, ShortStatistics());

    return;
  }
  return false;
}
