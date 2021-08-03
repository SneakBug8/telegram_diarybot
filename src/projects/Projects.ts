import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { Server } from "..";
import dateFormat = require("dateformat");
import TelegramBot = require("node-telegram-bot-api");
import { ProjectRecord, ProjectsData, Project } from "./ProjectsData";

let data = new ProjectsData();
const datafilepath = path.resolve(Config.dataPath(), "projects.json");

let lastHourChecked = -1;
const whattimeofaday = 12;

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/projects done" }, { text: "/projects list" }, { text: "/projects stats" }],
    [{ text: "/exit" }],
  ];
}

function reply(msg: MessageWrapper, text: string)
{
  msg.reply(text, getKeyboard());
}

export async function InitProjects()
{
  if (fs.existsSync(datafilepath)) {
    const file = fs.readFileSync(datafilepath);

    data = JSON.parse(file.toString()) as ProjectsData;

    console.log(`Read ${data.Projects.length} time entries and ${data.Records.length} existing entries.`);
  }
  else {
    console.log(`Created new datafile for projects.`);
    ProjectsSave();
  }

  setInterval(ProjectsCycle, 15 * 60 * 1000);
}

export async function ProjectsSave()
{
  const tdata = JSON.stringify(data);
  fs.writeFileSync(datafilepath, tdata);
}

async function ProjectsCycle()
{
  const now = new Date(Date.now());

  const triggeredentries = new Array<Project>();

  if (lastHourChecked !== now.getHours()) {
    for (const entry of data.Projects) {
      if (entry.time === now.getHours() && entry.day === now.getDay() % 7) {
        console.log(now + " sending time");
        triggeredentries.push(entry);
      }
    }
  }

  let msg = `Ваши текущие проекты:`;

  for (const en of triggeredentries) {
    msg += "\n" + en.subject;
  }

  Server.SendMessage(msg);

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

export async function ProcessProjects(message: MessageWrapper)
{
  if (message.checkRegex(/\/projects done (.+)/)) {
    const subject = message.captureRegex(/\/projects done (.+)/);

    if (!subject) { return reply(message, `Specify which project to mark.`); }

    const proj = data.Projects.find((x) => x.subject === subject[1]);

    if (!proj) { return reply(message, `No such project.`); }

    const record = new ProjectRecord();
    record.subject = subject[1];
    record.datetime = new Date().toString();

    data.Records.push(record);
    ProjectsSave();

    reply(message, `Marked project ${subject[1]} worked on.`);
    return;
  }
  if (message.checkRegex(/\/projects list/)) {
    let res = "";

    const sorted = data.Projects.sort((x, y) => (y.day - x.day) * 24 + (y.time - x.time));

    for (const entry of sorted) {
      res += `${entry.subject}: ${getWeekDays()[entry.day - 1]}, ${entry.time}h`;
    }

    reply(message, res);
    return;
  }
  if (message.checkRegex(/\/projects add (.+)/)) {
    const subject = message.captureRegex(/\/projects add (.+)/);

    if (!subject) { return reply(message, `Specify which project to add.`); }

    for (let i = 0; i < 7; i++) {
      const proj = new Project();
      proj.day = i;
      proj.time = whattimeofaday;
      proj.subject = subject[1];
      data.Projects.push(proj);
    }

    ProjectsSave();

    reply(message, `Added project ${subject[1]}.`);
    return;
  }
  if (message.checkRegex(/\/projects/)) {
    reply(message, `Projects module.`);

    return;
  }
  return false;
}