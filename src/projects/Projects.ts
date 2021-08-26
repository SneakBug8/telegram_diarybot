import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { Server, setWaitingForValue } from "..";
import dateFormat = require("dateformat");
import TelegramBot = require("node-telegram-bot-api");
import { ProjectRecord, ProjectsData, Project } from "./ProjectsData";

let data = new ProjectsData();
let Records = new Array<ProjectRecord>();

const datafilepath = path.resolve(Config.dataPath(), "projects.json");
const recordsfilepath = path.resolve(Config.dataPath(), "projectrecords.json");

let lastHourChecked = -1;
const whattimeofaday = 18;

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/projects done" }, { text: "/projects add" }, { text: "/projects delete" }],
    [{ text: "/projects list" }, { text: "/projects stats" }],
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

    console.log(`Read ${data.Projects.length} time entries.`);
  }
  else {
    console.log(`Created new datafile for projects.`);
    ProjectsSave();
  }

  if (fs.existsSync(recordsfilepath)) {
    const file = fs.readFileSync(recordsfilepath);

    Records = JSON.parse(file.toString()) as ProjectRecord[];

    console.log(`Read ${Records.length} entries.`);
  }
  else {
    console.log(`Created new datafile for project records.`);
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

  if (triggeredentries.length) {

    let msg = `Ваши текущие проекты:`;

    for (const en of triggeredentries) {
      const y = Records.filter((x) => x.subject === en.subject);
      msg += "\n" + en.subject + `(${y.length * 100 / y.length}%,` +
        `last: ${y[Records.length - 1].datetime})`;

      en.suggestedTimes++;
    }

    data.TotalDays++;
    ProjectsSave();

    Server.SendMessage(msg);
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

export async function ProcessProjects(message: MessageWrapper)
{
  if (message.checkRegex(/\/projects done/)) {
    setWaitingForValue(
      `Write the name of the project to be marked.`,
      (msg) =>
      {
        const subject = msg.message.text;

        if (!subject) { return reply(message, `Specify which project to mark.`); }

        const proj = data.Projects.find((x) => x.subject.includes(subject));

        if (!proj) { return reply(message, `No such project.`); }

        proj.doneTimes++;

        const record = new ProjectRecord();
        record.subject = subject;
        record.datetime = new Date().toString();

        Records.push(record);
        ProjectsSave();

        reply(message, `Marked project ${subject} worked on.`);
      });
    return;
  }
  if (message.checkRegex(/\/projects list/)) {
    let res = "";

    const sorted = data.Projects.sort((x, y) => (x.day - y.day) * 24 + (x.time - y.time));

    for (const entry of sorted) {
      const y = Records.filter((x) => x.subject === entry.subject);
      res += `\n${entry.subject} (${y.length * 100 / Records.length}%`;
      if (y.length) {
        res += `, last: ${y[y.length - 1].datetime}`;
      }
      res += `): ${getWeekDays()[entry.day]}, ${entry.time}h`;
    }

    reply(message, res);
    return;
  }
  if (message.checkRegex(/\/projects stats/)) {
    let res = "";

    const sorted = data.Projects.sort((x, y) => (x.day - y.day) * 24 + (x.time - y.time));
    const subjects = new Array<string>();

    for (const entry of sorted) {
      if (subjects.includes(entry.subject)) {
        continue;
      }

      const y = Records.filter((x) => x.subject === entry.subject);
      res += `\n${entry.subject} (${y.length}/${data.TotalDays}, ${y.length * 100 / Records.length}%`;
      subjects.push(entry.subject);
    }

    reply(message, res);
    return;
  }
  if (message.checkRegex(/\/projects add/)) {
    setWaitingForValue(`Write the name of the project to add.`,
      (msg) =>
      {
        const subject = msg.message.text;

        if (!subject) { return reply(message, `Specify which project to add.`); }

        for (let i = 0; i < 7; i++) {
          const proj = new Project();
          proj.day = i;
          proj.time = whattimeofaday;
          proj.subject = subject;
          data.Projects.push(proj);
        }

        ProjectsSave();

        reply(message, `Added project ${subject}.`);
        return;
      });
    return;
  }
  if (message.checkRegex(/\/projects delete/)) {
    setWaitingForValue(`Write the name of the project to remove.`,
      (msg) =>
      {
        const subject = msg.message.text;

        if (!subject) { return reply(message, `Specify which project to add.`); }

        const projs = data.Projects.filter((x) => !x.subject.includes(subject));

        data.Projects = projs;

        ProjectsSave();

        reply(message, `Removed all occurences of project ${subject}.`);
        return;
      });

    return;
  }
  if (message.checkRegex(/\/projects/)) {
    reply(message, `Projects module.`);

    return;
  }
  return false;
}