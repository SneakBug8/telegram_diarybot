import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { Server, setWaitingForValue } from "..";
import TelegramBot = require("node-telegram-bot-api");
import { NotifierData, NotifierEntry } from "./NotifierData";
import dateFormat = require("dateformat");

let data = new NotifierData();

const datafilepath = path.resolve(Config.dataPath(), "notifier.json");

const whattimeofaday = 10;

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/notify add" }, { text: "/notify list" }],
    [{ text: "/exit" }],
  ];
}

function reply(msg: MessageWrapper, text: string)
{
  msg.reply(text, getKeyboard());
}

export async function InitNotifier()
{
  if (fs.existsSync(datafilepath)) {
    const file = fs.readFileSync(datafilepath);

    data = JSON.parse(file.toString()) as NotifierData;

    console.log(`Read ${data.Pending.length} future notifications.`);
  }
  else {
    console.log(`Created new datafile for Notifier.`);
    NotifierSave();
  }

  setInterval(NotifierCycle, 15 * 60 * 1000);
}

export async function NotifierSave()
{
  const tcontacts = JSON.stringify(data);
  fs.writeFileSync(datafilepath, tcontacts);
}

async function NotifierCycle()
{
  const now = new Date(Date.now());

  if (now.getHours() === whattimeofaday && now.getMinutes() <= 30 && data.lastSend !== now.getDay()) {
    console.log(now + " sending time");
    NotifierSend();
  }
}

async function NotifierSend()
{
  const now = new Date(Date.now());
  data.lastSend = now.getDay();

  let res = `Ваши уведомления на сегодня:\n`;

  const previds = new Array<number>();
  const i = res.length;

  const fordelete = new Array<NotifierEntry>();

  for (const pending of data.Pending) {
    const datetime = (pending.datetime) ? new Date(pending.datetime) : new Date();
    if (datetime.getTime() <= Date.now()) {
      res += `${dateFormat(datetime, "HH:MM")} - ${pending.name}`;
      fordelete.push(pending);
    }
  }

  for (const del of fordelete) {
    data.Pending = data.Pending.filter((x) => x.id !== del.id);
    data.Archive.push(del);
  }

  if (i !== res.length) {
    Server.SendMessage(res);
    NotifierSave();
  }
}

export function ParseDate(date: string)
{
  const regexp = /(in|через) ([0-9]+) (дней|мес|часов|days|hours|months|месяцев)/;
  const params = regexp.exec(date);

  if (!params) {
    return null;
  }

  let ms = Number.parseInt(params[2], 10) * 60 * 1000;

  if (params[3] === "дней" || params[3] === "days") {
    ms *= 24 * 60;
  }
  else if (params[3] === "часов" || params[3] === "hours") {
    ms *= 60;
  }
  else if (params[3] === "мес" || params[3] === "months" || params[3] === "месяцев") {
    ms *= 24 * 60 * 30;
  }

  return new Date(Date.now() + ms);
}

export async function ProcessNotifier(message: MessageWrapper)
{
  if (message.checkRegex(/\/notify add/)) {
    setWaitingForValue(`Please, write when to notify and about what, separated by ";".
    Пример: через 9 дней; Аннушка разлила масло`,
      (msg) =>
    {
      const name = msg.captureRegex(/(.+); (.+)/);

      if (!name) { return; }

      const stat = new NotifierEntry();
      stat.name = name[2];
      stat.id = data.lastId + 1;
      const datetime = ParseDate(name[1]);
      if (!datetime) {
        reply(message, `Wrong date or time.`);
      }
      stat.datetime = (datetime as Date).toString();

      data.Pending.push(stat);
      data.lastId++;
      NotifierSave();

      reply(message, `Added notification ${name[2]} ${name[1]} with id ${stat.id}.`);
    });
    return;
  }
  if (message.checkRegex(/\/notify list/)) {
    let res = "";

    for (const not of data.Pending) {
      res += `${dateFormat(not.datetime, "dddd, mmmm dS, yyyy, HH:MM")} - ${not.name}`;
    }

    reply(message, res);
    return;
  }
  if (message.checkRegex(/\/notify/)) {
    reply(message, `Notifier module.`);

    return;
  }
  return false;
}