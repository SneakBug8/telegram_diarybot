import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { Server, setWaitingForValue } from "..";
import { InvestmentData } from "./InvestmentData";
import TelegramBot = require("node-telegram-bot-api");

let data = new InvestmentData();

const datafilepath = path.resolve(Config.dataPath(), "investment.json");
const howmanyperday = 1;
const whattimeofaday = 12;

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
  data.balance *= Math.pow(data.targetpercentage, 1 / 365) / 100 + 1;
  data.days++;

  if (data.delta >= 0) {
    await Server.SendMessage(`Не забудь инвестировать! Необходимо довложить: ${data.delta}` +
      `Цель: ${ data.investperday } в день, ${ data.targetpercentage } % годовых. Ты уже скопил: ${data.balance}`);
  }

  InvestmentSave();
}

function FullStatistics()
{
  return `Необходимо довложить: ${data.delta}. ` +
  `Цель: ${ data.investperday } в день, ${ data.targetpercentage }% годовых. Ты уже скопил: ${data.balance - data.delta}`;
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
  if (message.checkRegex(/\/investment/) || message.checkRegex(/\/investment stats/)) {
    console.log("investments");
    reply(message, FullStatistics());

    return;
  }
  return false;
}
