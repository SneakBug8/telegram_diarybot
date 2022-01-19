import { MessageWrapper } from "../MessageWrapper";
import { Server, setWaitingForValue } from "..";
import TelegramBot = require("node-telegram-bot-api");
import { MIS_DT } from "../util/MIS_DT";
import { EvergreenEntry } from "./EvergreenEntry";
import { getAllPosts, GetPost, LoadPosts } from "../postviews/PostViews";
import { Sleep } from "../util/Sleep";
import { WebApi } from "../api/web";

import * as express from "express";
import { Symbols } from "../util/Symbols";

const whattimeofaday = 18;

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/evergreen new" }, { text: "/evergreen update" }, { text: "/evergreen list" }],
    [{ text: "/exit" }],
  ];
}

function reply(msg: MessageWrapper, text: string)
{
  msg.reply(text, getKeyboard());
}

let lastDay = 0;

export async function EvergreenCycle()
{
  const now = new Date(Date.now());

  const triggeredentries = new Array<EvergreenEntry>();

  if (lastDay !== now.getDay() && now.getHours() === whattimeofaday) {
    lastDay = now.getDay();
    // Execute

    const entries = await EvergreenEntry.GetOldEntries();

    if (!entries.length) {
      return;
    }

    let msg = `Старые статьи для обновления`;
    const end = `---\nИтого: ${entries.length}`;

    for (const en of entries) {
      const t = "\n" + en.title + ` (${en.Updates}/${MIS_DT.FormatDate(en.UPDATE_DT)})`;
      if (msg.length + t.length + end.length <= 4000) {
        msg += t;
      }
    }
    Server.SendMessage(msg + end);
  }
}

async function AddEntry(message: MessageWrapper, postId: string, verbose = false)
{
  const post = await GetPost(Number.parseInt(postId + "", 10));

  if (!post) {
    throw new Error(`Wrong post id ${postId}.`);
  }

  // console.log(post.id);

  const entry = new EvergreenEntry();
  entry.postId = post.id;
  entry.title = post.title.rendered;
  entry.MIS_DT = new Date(post.date).getTime();
  entry.UPDATE_DT = new Date(post.modified).getTime();

  await EvergreenEntry.Insert(entry);

  if (verbose) {
    return reply(message, `Created evergreen entry for post "${entry.title}"`);
  }
}

async function UpdateEntry(message: MessageWrapper, postId: string, verbose = false)
{
  const post = await GetPost(Number.parseInt(postId + "", 10));
  const entries = await EvergreenEntry.GetWithPostId(postId);

  if (!post) {
    throw new Error(`Wrong post id ${postId}.`);
  }
  if (!entries.length) {
    throw new Error(`No entry for post ${postId}.`);
  }

  const entry = entries[0];

  // console.log(post.id);

  entry.postId = post.id;
  entry.title = post.title.rendered;
  entry.MIS_DT = new Date(post.date).getTime();

  if (entry.UPDATE_DT !== new Date(post.modified).getTime()) {
    entry.Updates++;
  }

  entry.UPDATE_DT = new Date(post.modified).getTime();

  await EvergreenEntry.Update(entry);

  if (verbose) {
    return reply(message, `Updated evergreen entry for post "${entry.title}"`);
  }
}


async function SwitchEntry(message: MessageWrapper, postId: string, verbose = false)
{
  const post = await GetPost(Number.parseInt(postId + "", 10));
  const entries = await EvergreenEntry.GetWithPostId(postId);

  if (!post) {
    throw new Error(`Wrong post id ${postId}.`);
  }
  if (!entries.length) {
    throw new Error(`No entry for post ${postId}.`);
  }

  const entry = entries[0];

  // console.log(post.id);

  entry.enabled = !entry.enabled;
  await EvergreenEntry.Update(entry);

  if (verbose) {
    return reply(message, `Switched evergreen entry for post "${entry.title}"`);
  }
}

export async function ProcessEvergreen(message: MessageWrapper)
{
  if (message.checkRegex(/\/evergreen new/)) {
    setWaitingForValue(
      `Write postId of the article.`,
      async (msg) =>
      {
        return await AddEntry(message, msg.message.text + "", true);
      });
    return;
  }
  if (message.checkRegex(/\/evergreen update/)) {
    setWaitingForValue(
      `Write postId of the article.`,
      async (msg) =>
      {
        return await UpdateEntry(message, msg.message.text + "", true);
      });
    return;
  }
  if (message.checkRegex(/\/evergreen switch/)) {
    setWaitingForValue(
      `Write postId of the article.`,
      async (msg) =>
      {
        return await SwitchEntry(message, msg.message.text + "", true);
      });
    return;
  }
  if (message.checkRegex(/\/evergreen list/)) {
    let res = "Oldest entries are as following:";

    const entries = await EvergreenEntry.Enabled();

    const sorted = entries.sort((a, b) => a.UPDATE_DT - b.UPDATE_DT);

    let i = 0;
    for (const entry of sorted) {
      const post = await GetPost(entry.postId);

      res += `\n${entry.title}` +
        ` (${entry.Updates} / ${MIS_DT.FormatDate(entry.UPDATE_DT)}), ${post.views || 0} views`;

      i++;
      if (i > 19) {
        break;
      }
    }

    reply(message, res);
    return;
  }
  if (message.checkRegex(/\/evergreen migrate/)) {
    const post = await getAllPosts();

    let a = 0;
    let b = 0;

    for (const c of post) {
      const entry = await EvergreenEntry.GetWithPostId(c.id + "");

      if (!c) {
        console.log("Empty post entry delivered");
      }

      try {
        if (entry.length) {
          b++;
          await UpdateEntry(message, c.id + "");
        }
        else {
          a++;
          await AddEntry(message, c.id + "");
        }
      }
      catch (e) {
        reply(message, c.id + " e: " + e + "");
      }

      await Sleep(100);
    }
    reply(message, `Migration complete: updated ${b} entries and created ${a} new.`);
    return;
  }
  if (message.checkRegex(/\/evergreen/)) {
    reply(message, `Evergreen posts module.`);

    return;
  }
  return false;
}

export async function InitEverGreen()
{
  WebApi.app.get("/evergreen", OnEvergreen);
}

async function OnEvergreen(req: express.Request, res: express.Response)
{
  const entries = await EvergreenEntry.All();

  const posts = await getAllPosts();

  for (const entry of entries) {
    const post = posts.find((x) => x.id === entry.postId);
    (entry as any).views = post?.views || 0;
    (entry as any).rate = (entry as any).views / (MIS_DT.GetExact() - entry.UPDATE_DT);
    (entry as any).link = post.link;
    (entry as any).language =
      Symbols.Russian().some((x) => entry.title.toLowerCase().includes(x)) ? "RU" : "EN";
  }

  entries.sort((a, b) => (b as any).rate - (a as any).rate);

  res.json(entries);
}