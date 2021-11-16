import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";

import { Server, setWaitingForValue } from "..";
import dateFormat = require("dateformat");
import TelegramBot = require("node-telegram-bot-api");
import { StringIncludes } from "../util/EqualString";
import { Connection } from "../Database";
import { Todo } from "./TodoData";

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

export async function InitTodos()
{
  setInterval(TodoCycle, 15 * 60 * 1000);
}

async function GetActiveTodos()
{
  return TodosRepository().where("done", "false").select().orderBy("id", "desc");
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

async function TodoCycle()
{
  const now = new Date(Date.now());

  const todos = await GetActiveTodos();

  if (todos.length) {
    let msg = `Ваши текущие задачи:`;

    for (const en of todos) {
      msg += "\n" + en.subject;

      en.suggestedTimes++;

      await UpdateTodo(en);
    }

    Server.SendMessage(msg);
  }

  lastHourChecked = now.getHours();
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
        const proj = todos.find((x) => x.subject.toLowerCase().includes(subject.toLowerCase()));

        if (!proj) { return reply(message, `No such todo.`); }

        proj.done = true;
        await UpdateTodo(proj);

        reply(message, `Marked todo ${proj.subject} completed.`);
      });
    return;
  }
  if (message.checkRegex(/\/todo list/)) {
    TodoCycle();
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
        const proj = todos.find((x) => x.subject.toLowerCase().includes(subject.toLowerCase()));
        if (!proj) { return reply(message, `No such todo.`); }

        await DeleteTodo(proj);

        reply(message, `Removed todo ${subject}.`);
        return;
      });

    return;
  }
  if (message.checkRegex(/^\/todo$/)) {
    reply(message, `Todo module.`);

    return;
  }
  return false;
}