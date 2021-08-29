import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { Server, setWaitingForValue } from "..";
import dateFormat = require("dateformat");
import TelegramBot = require("node-telegram-bot-api");
import { ProjectRecord, ProjectsData, Project } from "./ProjectsData";

let data = new ProjectsData();
const datafilepath = path.resolve(Config.dataPath(), "projects.json");

let lastHourChecked = -1;
const whattimeofaday = 18;

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/projects done" }, { text: "/projects add" }, { text: "/projects delete" }],
    [{ text: "/projects list" }, { text: "/projects stats" }],
    [{ text: "/project add day" }, { text: "/project remove day" }, { text: "/project set time" }],
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
      // console.log(`hours: ${entry.time}, now: ${now.getHours()}, days: ${entry.days}, now: ${now.getDay() % 7}`);
      if (entry.time === now.getHours() && entry.days.find((x) => x === now.getDay() % 7)) {
        triggeredentries.push(entry);
      }
    }
  }

  if (triggeredentries.length) {

    let msg = `Ваши текущие проекты:`;

    for (const en of triggeredentries) {
      msg += "\n" + en.subject + `(${en.doneTimes}/${en.suggestedTimes}%)`;

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

function getProjectDaysFormatted(proj: Project)
{
  let res = "";
  const days = getWeekDays();

  for (const day of proj.days) {
    res += days[day] + ", ";
  }

  return res.slice(0, res.length - 2);
}

function projectsSort(a: Project, b: Project)
{
  let depth = 0;

  while (true) {
    if (a.days.length > depth && b.days.length > depth) {
      const da = a.days[depth];
      const db = b.days[depth];

      if (da !== db) {
        return da - db;
      }
    }
    else if (a.days.length !== b.days.length) {
      return b.days.length - a.days.length;
    }
    else {
      return a.time - b.time;
    }

    depth++;
  }
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

        const proj = data.Projects.find((x) => x.subject.toLowerCase().includes(subject));

        if (!proj) { return reply(message, `No such project.`); }

        proj.doneTimes++;

        ProjectsSave();

        reply(message, `Marked project ${proj.subject} worked on.`);
      });
    return;
  }
  if (message.checkRegex(/\/projects list/)) {
    let res = "";

    const sorted = data.Projects.sort(projectsSort);

    for (const entry of sorted) {
      res += `\n${entry.subject} -  ${entry.time}h, ${getProjectDaysFormatted(entry)}.`;
    }

    reply(message, res);
    return;
  }
  if (message.checkRegex(/\/projects stats/)) {
    let res = "";

    const sorted = data.Projects.sort(projectsSort);
    const subjects = new Array<string>();

    for (const entry of sorted) {
      if (subjects.includes(entry.subject)) {
        continue;
      }

      res += `\n${entry.subject}` +
        ` (${entry.doneTimes} / ${entry.suggestedTimes}, ${entry.doneTimes * 100 / entry.suggestedTimes}%)`;
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

        const proj = new Project();
        proj.days = [];
        proj.time = whattimeofaday;
        proj.subject = subject;
        data.Projects.push(proj);

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

        reply(message, `Removed project ${subject}.`);
        return;
      });

    return;
  }
  if (message.checkRegex(/\/project add day/)) {
    setWaitingForValue(`Write the name of the project to add day to.`,
      (msg) =>
      {
        const subject = msg.message.text + "";

        if (!subject) { return reply(message, `Specify which project to add day to.`); }

        const proj = data.Projects.find((x) => x.subject.includes(subject));

        if (!proj) { return reply(message, `No such project.`); }

        setWaitingForValue(`Write number of the day to add to the project.`,
          (m) =>
          {
            const day = Number.parseInt(m.message.text + "", 10);
            const existingday = proj.days.find((x) => x === day);

            if (day < 0 || day > 6) {
              return reply(m, "Project days must be in range [0,6].");
            }

            if (existingday) {
              return reply(m, "Project already has this day in schedule.");
            }

            proj.days.push(day);
            proj.days = proj.days.sort((a, b) => a - b);

            ProjectsSave();
            return reply(m, `Added day ${day} to the project ${proj.subject}. ` +
              `Now its schedule is ${getProjectDaysFormatted(proj)}.`);
          });
        return;
      });
    return;
  }
  if (message.checkRegex(/\/project remove day/)) {
    setWaitingForValue(`Write the name of the project to remove day from.`,
      (msg) =>
      {
        const subject = msg.message.text + "";

        if (!subject) { return reply(message, `Specify which project to remove day from.`); }

        const proj = data.Projects.find((x) => x.subject.includes(subject));

        if (!proj) { return reply(message, `No such project.`); }

        setWaitingForValue(`Write number of the day to remove from the project.`,
          (m) =>
          {
            const day = Number.parseInt(m.message.text + "", 10);
            const existingday = proj.days.find((x) => x === day);

            if (day < 0 || day > 6) {
              return reply(m, "Project days must be in range [0,6].");
            }

            if (!existingday) {
              return reply(m, "Project doesn't have this day in schedule.");
            }

            proj.days = proj.days.filter((x) => x !== day);

            ProjectsSave();
            return reply(m, `Removed day ${day} from the project ${proj.subject}. ` +
              `Now its schedule is ${getProjectDaysFormatted(proj)}.`);
          });
        return;
      });
    return;
  }
  if (message.checkRegex(/\/project set time/)) {
    setWaitingForValue(`Write the name of the project to change time.`,
      (msg) =>
      {
        const subject = msg.message.text + "";

        if (!subject) { return reply(message, `Specify which project to remove day from.`); }

        const proj = data.Projects.find((x) => x.subject.includes(subject));

        if (!proj) { return reply(message, `No such project.`); }

        setWaitingForValue(`Write time.`,
          (m) =>
          {
            const time = Number.parseInt(m.message.text + "", 10);

            if (time < 0 || time > 23) {
              return reply(m, "Project time must be in range [0,23].");
            }

            proj.time = time;

            ProjectsSave();
            return reply(m, `Set project ${proj.subject} time to ${time}.`);
          });
        return;
      });
    return;
  }
  if (message.checkRegex(/^\/projects force$/)) {
    ProjectsCycle();
    return;
  }
  if (message.checkRegex(/^\/projects$/)) {
    reply(message, `Projects module.`);

    return;
  }
  return false;
}