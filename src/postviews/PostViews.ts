// https://sneakbug8.com/wp-json/wp/v2/posts
// https://sneakbug8.com/wp-json/wp/v2/posts?_fields=id,title,link,views

import { MessageWrapper } from "../MessageWrapper";
import TelegramBot = require("node-telegram-bot-api");
import { shortNum, StringIncludes } from "../util/EqualString";
import { Connection } from "../Database";
import { PostViewEntry } from "./PostViewData";
import axios from "axios";
import { Server } from "..";
import { Sleep } from "../util/Sleep";
import { MIS_DT } from "../util/MIS_DT";

export const PostViewsRepository = () => Connection<PostViewEntry>("PostViews");

let lastHourChecked = -1;
const whattimeofaday = 16;

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/posts top" }, { text: "/posts trending" }, { text: "/posts force" }],
    [{ text: "/exit" }]
  ];
}

function reply(msg: MessageWrapper, text: string)
{
  msg.reply(text, getKeyboard());
}

async function GetLastBatch()
{
  return PostViewsRepository().max("MIS_DT as c");
}

function GetLastWeekMisDT()
{
  return MIS_DT.GetExact() - 7  * MIS_DT.OneDay();
}

function GetDailyMisDT()
{
  return MIS_DT.GetExact() - 1 * MIS_DT.OneDay();
}

async function GetWeeklyPostViews(postid: number)
{
  const date = await GetLastBatch();
  // console.log(`MaxDate ${JSON.stringify(date)}`);
  return PostViewsRepository().where("MIS_DT", "<=", GetLastWeekMisDT()).andWhere("postId", postid).select()
    .orderBy("MIS_DT", "desc").limit(1);
}

async function GetDailyPostViews(postid: number)
{
  const date = await GetLastBatch();
  // console.log(`MaxDate ${JSON.stringify(date)}`);
  //.where("MIS_DT", GetDailyMisDT())
  return PostViewsRepository().andWhere("postId", postid).select()
    .orderBy("MIS_DT", "desc").limit(1);
}

async function GetSimilarEntries(postId: number, MIS_DT: number)
{
  return PostViewsRepository().where({ postId, MIS_DT }).select();
}

async function UpdateEntry(entry: PostViewEntry)
{
  return PostViewsRepository().where("id", entry.id).update(entry);
}

async function AddEntry(entry: PostViewEntry)
{
  return PostViewsRepository().insert(entry);
}

let pagesAvailable = 0;

async function getPostsList(page: number = 1)
{
  try {
    const res = await axios.get(
      `https://sneakbug8.com/wp-json/wp/v2/posts?_fields=id,title,link,views&per_page=100&page=${page}`);

    pagesAvailable = res.headers["x-wp-totalpages"];
    // console.log(`PagesAvailable: ${pagesAvailable}`);

    console.log(`Fetched ${res.data.length} posts via API`);

    return res.data as any[];
  }
  catch (e) {
    console.error(e);
    return [];
  }
}

async function LoadPosts(weekly: boolean = false)
{
  const posts = await getPostsList(1);

  for (let i = 2; i <= pagesAvailable; i++) {
    await Sleep(2000);
    posts.push(await getPostsList(i));
  }
  const entries = [];

  const mis_dt = MIS_DT.GetExact();

  console.log(`Got ${posts.length} posts.`);

  for (const post of posts) {
    let comment = "";
    let timeSinceLastUpdate = 0;

    if (!post.id) {
      continue;
    }

    const dbentries = await GetSimilarEntries(post.id, mis_dt);
    const entry = (dbentries.length) ? dbentries[0] : new PostViewEntry();

    const newentry = !dbentries.length;

    // console.log(`1 New entry for ${post.id}: ${newentry}`);

    if (newentry) {
      entry.postId = post.id;
      entry.title = HtmlParse(post?.title?.rendered);
      entry.views = post.views;
      entry.MIS_DT = mis_dt;
      entry.CREATED_DT = mis_dt;

      if (!entry.views) {
        continue;
      }
    }

    const mentries = (weekly ? await GetDailyPostViews(entry.postId) : await GetWeeklyPostViews(entry.postId));

    // console.log(`2 mentries ${JSON.stringify(mentries)}`);

    if (mentries.length) {
      const lastentry = mentries[0];

      if (newentry) {
        entry.change = entry.views - lastentry.views;
        entry.CREATED_DT = lastentry.CREATED_DT;
      }

      timeSinceLastUpdate = (entry.MIS_DT - lastentry.MIS_DT) / MIS_DT.OneDay();

      // console.log(`3 Time since last update for ${post.id} is ${timeSinceLastUpdate}`);

      if (lastentry.MIS_DT !== GetDailyMisDT()) {
        comment = `${shortNum(timeSinceLastUpdate)}d`;
      }

      //console.log(`Post ${lastentry.postId} had ${lastentry.views} views.`);
    }
    else if (!mentries.length && newentry) {
      entry.change = Number.parseInt(entry.views + "", 10);
      entry.CREATED_DT = mis_dt;
    }

    if (newentry) {
      await AddEntry(entry);
    }

    entries.push({ entry, comment, timeSinceLastUpdate });

  }
  return entries;
}

export async function PostsCycle()
{
  const now = new Date(Date.now());

  if (lastHourChecked !== now.getHours() && now.getHours() === whattimeofaday && now.getDay() === 5) {
    await PostViewsSendWeekly();
  }
  else if (lastHourChecked !== now.getHours() && now.getHours() === whattimeofaday) {
    await PostViewsSendDaily();
  }

  lastHourChecked = now.getHours();
}

async function PostViewsSendWeekly()
{
  const entries = await LoadPosts(true);

  let res = "Топ статей по просмотрам за неделю:\n";
  let total = 0;

  entries.sort((a, b) => b.entry.change - a.entry.change);

  for (const t of entries) {
    const entry = t.entry;

    if (!entry.views || !entry.change) {
      continue;
    }

    if (entry.change > 5) {
      const mark = (entry.change >= 0) ? "+" : "-";
      res += `${entry.title} - ${entry.views} (${mark}${entry.change}` +
        `${(t.comment) ? ", " + t.comment : ""}`
        + `)\n`;
    }

    total += entry.change;
  }

  res += `---\nВсего просмотров за неделю:${total}`;

  await Server.SendMessage(res);

  return "";
}

async function PostViewsSendDaily()
{
  const entries = await LoadPosts();

  let res = "Топ статей по просмотрам за день:\n";

  entries.sort((a, b) => b.entry.change - a.entry.change);

  let total = 0;

  for (const t of entries) {
    const entry = t.entry;

    if (!entry.views || !entry.change) {
      console.log(`No change or views for ${entry.postId}`);
      continue;
    }

    if (entry.change > 5) {

      const mark = (entry.change >= 0) ? "+" : "-";
      res += `${entry.title} - ${entry.views} (${mark}${entry.change}` +
        `${(t.comment) ? ", " + t.comment : ""}` +
        `)\n`;
    }

    total += entry.change;
  }

  res += `---\nВсего просмотров за день:${total}`;

  await Server.SendMessage(res);

  return "";
}

async function TopPosts()
{
  const entries = await LoadPosts();

  let res = "Топ статей по просмотрам:\n";

  entries.sort((a, b) => b.entry.views - a.entry.views);

  for (const t of entries) {
    const entry = t.entry;

    if (!entry.views) {
      continue;
    }

    const mark = (entry.change >= 0) ? "+" : "-";
    res += `${entry.title} - ${entry.views} (${new Date(entry.CREATED_DT).toDateString()})\n`;
  }

  return res;
}

async function TrendingPosts()
{
  const entries = await LoadPosts();

  let res = "Трендовые статьи:\n";
  let total = 0;
  let days = 0;

  entries.sort((a, b) => (a.entry.CREATED_DT / a.entry.views) - (b.entry.CREATED_DT / b.entry.views));

  for (const t of entries) {
    const entry = t.entry;

    if (!entry.views) {
      continue;
    }
    const entrydays = (entry.MIS_DT - entry.CREATED_DT) / 24 * 60 * 60 * 1000;
    total += entry.views;
    days += entrydays;

    const mark = (entry.change >= 0) ? "+" : "-";
    res += `${entry.title} - ${entry.views} (${new Date(entry.CREATED_DT).toDateString()})\n`;
  }

  res += `---\nВ среднем просмотров за день показа: ${shortNum(total / days)}`;

  return res;
}

export async function ProcessPostViews(message: MessageWrapper)
{
  if (message.checkRegex(/\/posts force/)) {
    await PostViewsSendDaily();
    return;
  }
  if (message.checkRegex(/\/posts top/)) {
    reply(message, await TopPosts());
    return;
  }
  if (message.checkRegex(/\/posts trending/)) {
    reply(message, await TrendingPosts());
    return;
  }
  return false;
}

function HtmlParse(text: string)
{
  const res = text + "";
  res.replace("&#8211;", "—");

  return res;
}