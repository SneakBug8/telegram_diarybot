import { MessageWrapper } from "../MessageWrapper";
import * as express from "express";
import { Server, setWaitingForValue } from "..";
import dateFormat = require("dateformat");
import TelegramBot = require("node-telegram-bot-api");
import { StringIncludes } from "../util/EqualString";
import { Connection } from "../Database";
import { Todo } from "./TodoData";
import { MIS_DT } from "../util/MIS_DT";
import { WebApi } from "../api/web";
import { Color } from "../util/Color";
import { Config } from "../config";

export const TodosRepository = () => Connection<Todo>("Todos");

let lastHourChecked = -1;
const whattimeofaday = 18;

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/todo done" }, { text: "/todo delete" }, { text: "/todo add" }],
    [{ text: "/todo list" }],
    [{ text: "/exit" }],
  ];
}

function reply(msg: MessageWrapper, text: string)
{
  msg.reply(text, getKeyboard());
}

async function GetActiveTodos()
{
  return TodosRepository().where("done", "0").select().orderBy("id", "desc");
}

async function All()
{
  return TodosRepository().select();
}

async function UpdateTodo(todo: Todo)
{
  return TodosRepository().update(todo).where("id", todo.id);
}

async function AddTodo(todo: Todo)
{
  return TodosRepository().insert(todo);
}

async function DeleteTodo(todo: Todo)
{
  return TodosRepository().where("id", todo.id).del();
}

export async function TodoCycle()
{
  const now = new Date(Date.now());

  if (lastHourChecked !== now.getHours() && now.getHours() === whattimeofaday) {
  } else { return; }

  const msg = await TodoSend();

  if (msg) {
    Server.SendMessage(msg);
  }

  lastHourChecked = now.getHours();
}

async function TodoSend()
{
  const todos = await GetActiveTodos();

  if (todos.length) {
    let msg = `Ваши текущие задачи:`;

    let i = 1;

    for (const en of todos) {
      msg += `\n${i}. ` + en.subject;

      en.suggestedTimes++;

      await UpdateTodo(en);
      i++;
    }

    return msg;
  }

  return "";
}

export async function ProcessTodos(message: MessageWrapper)
{
  if (message.checkRegex(/\/todo done/)) {
    setWaitingForValue(
      `Write the name of the todo to be marked.`,
      async (msg) =>
      {
        const subject = msg.message.text;

        if (!subject) { return reply(message, `Specify which todo to mark.`); }

        const todos = await GetActiveTodos();
        const proj = todos.find((x) => StringIncludes(x.subject, subject));

        if (!proj) { return reply(message, `No such todo.`); }

        proj.done = true;
        proj.DONE_DT = MIS_DT.GetExact();

        await UpdateTodo(proj);

        reply(message, `Marked todo ${proj.subject} completed.`);
      });
    return;
  }
  if (message.checkRegex(/\/todo list/)) {
    reply(message, await TodoSend());
    return;
  }
  if (message.checkRegex(/\/todo stats/)) {

  }
  if (message.checkRegex(/\/todo add/)) {
    setWaitingForValue(`Write the name of the todo to add.`,
      async (msg) =>
      {
        const subject = msg.message.text;

        if (!subject) { return reply(message, `Specify which todo to add.`); }

        const proj = new Todo();
        proj.subject = subject;

        await AddTodo(proj);

        reply(message, `Added todo ${subject}.`);
        return;
      });
    return;
  }
  if (message.checkRegex(/\/todo delete/)) {
    setWaitingForValue(`Write the name of the todo to remove.`,
      async (msg) =>
      {
        const subject = msg.message.text;

        if (!subject) { return reply(message, `Specify which todo to add.`); }

        const todos = await GetActiveTodos();
        const proj = todos.find((x) => StringIncludes(x.subject, subject));
        if (!proj) { return reply(message, `No such todo.`); }

        await DeleteTodo(proj);

        reply(message, `Removed todo ${subject}.`);
        return;
      });

    return;
  }
  if (message.checkRegex(/^\/todo$/)) {
    reply(message, `Todo module.\n` +
    `Dashboard: ${await Config.url()}todoschart.html`);

    return;
  }
  return false;
}

export function TodoInit()
{
  WebApi.app.get("/todos", OnTodos);
  WebApi.app.get("/todos/graph", OnTodosGraph);
}

async function OnTodos(req: express.Request, res: express.Response)
{
  res.json(await GetActiveTodos());
}

async function OnTodosGraph(req: express.Request, res: express.Response)
{

  const todos = await All();

  if (!todos) {
    return;
  }

  const created = new Array<number>();
  const done = new Array<number>();

  for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 30; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
    const c = todos.filter((x) => MIS_DT.RoundToDay(new Date(x.MIS_DT)) === i);
    const d = todos.filter((x) => MIS_DT.RoundToDay(new Date(x.DONE_DT)) === i);

    created.push(c.length);
    done.push(d.length);
  }
  // console.log(`${proj.subject}: ${arr}`);

  const datasets = new Array<object>();

  datasets.push({
    label: "Created",
    data: created,
    borderColor: Color.GetColor(0),
    fill: "origin",
    backgroundColor: Color.GetBackground(0)
  });
  datasets.push({
    label: "Done",
    data: done,
    borderColor: Color.GetColor(1),
    fill: "origin",
    backgroundColor: Color.GetBackground(1)
  });

  const labels = [];

  for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 30; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
    labels.push(MIS_DT.FormatDate(i));
  }

  res.json({ datasets, labels });
}