import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { Server } from "..";
import { LearningData, LearningRecord, LearningTimeEntry } from "./LearningData";
import dateFormat = require("dateformat");
import TelegramBot = require("node-telegram-bot-api");

let data = new LearningData();
const datafilepath = path.resolve(Config.dataPath(), "learning.json");

let lastHourChecked = -1;

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/learning start" }, { text: "/learning list" }, { text: "/learning stats" }],
    [{ text: "/learning force" }, { text: "/learning now" }, { text: "/learning end" }],
    [{ text: "/exit" }],
  ];
}

function reply(msg: MessageWrapper, text: string)
{
  msg.reply(text, getKeyboard());
}

export async function InitLearning()
{
  if (fs.existsSync(datafilepath)) {
    const file = fs.readFileSync(datafilepath);

    data = JSON.parse(file.toString()) as LearningData;

    console.log(`[Learning] Read ${data.Timetable.length} time entries and ${data.Records.length} existing entries.`);
  }
  else {
    const testtimeentry = new LearningTimeEntry();
    testtimeentry.subject = "Do something";
    testtimeentry.day = 7;
    testtimeentry.time = 14;

    data.Timetable.push(testtimeentry);
    console.log(`Created new datafile for learning.`);
    LearningSave();
  }

  setInterval(LearningCycle, 15 * 60 * 1000);
}

export async function LearningSave()
{
  const tdata = JSON.stringify(data);
  fs.writeFileSync(datafilepath, tdata);
}

async function LearningCycle()
{
  const now = new Date(Date.now());

  if (lastHourChecked !== now.getHours()) {
    for (const entry of data.Timetable) {
      if (entry.time === now.getHours() && entry.day === now.getDay() % 7) {
        console.log(now + " sending time");
        LearningSend(entry);
      }
    }
  }

  if (tempRecord.from !== 0) {
    LearningNotify(tempRecord);
  }

  lastHourChecked = now.getHours();
}

function getWeekDays()
{
  const locale = "en-GB";
  const baseDate = new Date(Date.UTC(2017, 0, 2)); // just a Monday
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(baseDate.toLocaleDateString(locale, { weekday: "long" }));
    baseDate.setDate(baseDate.getDate() + 1);
  }
  return weekDays;
}

async function LearningNotify(entry: LearningRecord)
{
  const to = Date.now();
  const time = new Date(to - tempRecord.from);

  const res = `Вы не забыли выключить запись ${entry.subject}? Она идёт уже ${dateFormat(time, "HH:MM", true)}`;

  Server.SendMessage(res);
}

async function LearningSend(entry: LearningTimeEntry)
{
  const now = new Date(Date.now());

  const res = `Займись делом. У вас в очереди - ${entry.subject}.`;

  Server.SendMessage(res);
  LearningSave();
}

let tempRecord = new LearningRecord();

export async function ProcessLearning(message: MessageWrapper)
{
  if (message.checkRegex(/\/learning start(.*)/)) {
    const subject = message.captureRegex(/\/learning start (.+)/);

    if (!subject) { return reply(message, `Specify which activity to start.`); }

    if (tempRecord.from !== 0) {
      reply(message, `Already doing ${subject[1]}.`);
      return;
    }

    tempRecord = new LearningRecord();
    tempRecord.subject = subject[1];
    tempRecord.from = Date.now();

    reply(message, `Started doing ${subject[1]}.`);

    return;
  }
  if (message.checkRegex(/\/learning now/)) {
    const to = Date.now();
    const time = new Date(to - tempRecord.from);

    reply(message, `${tempRecord.subject}: ${dateFormat(time, "HH:MM", true)}`);
    return;
  }
  if (message.checkRegex(/\/learning end/) || message.checkRegex(/\/learning stop/)) {
    tempRecord.to = Date.now();
    data.Records.push(tempRecord);
    LearningSave();

    reply(message, `Ended doing ${tempRecord.subject}.`);
    tempRecord.from = 0;
    return;
  }
  if (message.checkRegex(/\/learning list/)) {
    let res = "";

    const sorted = data.Timetable.sort((x, y) => (y.day - x.day) * 1000 + (y.time - x.time));

    for (const entry of sorted) {
      res += `${entry.subject}: ${getWeekDays()[entry.day - 1]}, ${entry.time}h\n`;
    }

    reply(message, res);
    return;
  }
  if (message.checkRegex(/\/learning stats/)) {
    let res = "";

    const resdata = new Map<string, number>();
    for (const entry of data.Records) {
      resdata.set(entry.subject,
        (entry.to - entry.from) + (resdata.get(entry.subject) || 0)
      );
    }

    for (const entry of resdata) {
      res += `${entry[0]}: ${dateFormat(entry[1], "HH:MM")}`;
    }

    reply(message, res);
    return;
  }
  if (message.checkRegex(/\/learning force/)) {
    LearningCycle();

    return;
  }
  if (message.checkRegex(/\/learning/)) {
    reply(message, `Learning module.`);

    return;
  }
  return false;
}