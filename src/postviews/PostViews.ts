// https://sneakbug8.com/wp-json/wp/v2/posts
// https://sneakbug8.com/wp-json/wp/v2/posts?_fields=id,title,link,views

import { MessageWrapper } from "../MessageWrapper";
import TelegramBot = require("node-telegram-bot-api");
import { StringIncludes } from "../util/EqualString";
import { Connection } from "../Database";
import { PostViewEntry } from "./PostViewData";
import axios from "axios";
import { Server } from "..";
import { Sleep } from "../util/Sleep";

export const PostViewsRepository = () => Connection<PostViewEntry>("PostViews");

let lastHourChecked = -1;
const whattimeofaday = 16;

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
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
  const mis_dt = new Date(Date.now());
  mis_dt.setHours(0);
  mis_dt.setMinutes(0);
  mis_dt.setSeconds(0);
  mis_dt.setMilliseconds(0);

  return mis_dt.getTime() - 7 * 24 * 60 * 60 * 1000;
}

function GetDailyMisDT()
{
  const mis_dt = new Date(Date.now());
  mis_dt.setHours(0);
  mis_dt.setMinutes(0);
  mis_dt.setSeconds(0);
  mis_dt.setMilliseconds(0);

  return mis_dt.getTime() - 24 * 60 * 60 * 1000;
}

async function GetWeeklyPostViews(postid: number)
{
  const date = await GetLastBatch();
  // console.log(`MaxDate ${JSON.stringify(date)}`);
  return PostViewsRepository().where("MIS_DT", GetLastWeekMisDT()).andWhere("postId", postid).select();
}

async function GetDailyPostViews(postid: number)
{
  const date = await GetLastBatch();
  // console.log(`MaxDate ${JSON.stringify(date)}`);
  return PostViewsRepository().where("MIS_DT", GetDailyMisDT()).andWhere("postId", postid).select();
}

async function GetSimilarEntries(entry: PostViewEntry)
{
  return PostViewsRepository().where({ postId: entry.postId, MIS_DT: entry.MIS_DT }).select();
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
    await Sleep(5000);
    posts.push(await getPostsList(i));
  }
  const entries = [];

  const mis_dt = new Date(Date.now());
  mis_dt.setHours(0);
  mis_dt.setMinutes(0);
  mis_dt.setSeconds(0);
  mis_dt.setMilliseconds(0);

  for (const post of posts) {
    const entry = new PostViewEntry();
    entry.postId = post.id;
    entry.title = HtmlParse(post?.title?.rendered);
    entry.views = post.views;
    entry.MIS_DT = mis_dt.getTime();

    if (!entry.views) {
      continue;
    }

    const mentries = (!weekly && await GetDailyPostViews(entry.postId)) || await GetWeeklyPostViews(entry.postId);

    if (mentries.length) {
      const lastentry = mentries[0];
      entry.change = entry.views - lastentry.views;

      entry.CREATED_DT = lastentry.CREATED_DT;

      //console.log(`Post ${lastentry.postId} had ${lastentry.views} views.`);
    }
    else {
      entry.change = entry.views;
      entry.CREATED_DT = mis_dt.getTime();
    }

    entries.push(entry);

    const dbentries = await GetSimilarEntries(entry);

    if (dbentries.length) {
      const dbentry = dbentries[0];
      entry.id = dbentry.id;
      await UpdateEntry(entry);
    }
    else {
      await AddEntry(entry);
    }
  }

  return entries;
}

export async function PostsCycle()
{
  const now = new Date(Date.now());

  if (lastHourChecked !== now.getHours() && now.getHours() === whattimeofaday && now.getDay() === 4) {
    await PostViewsSendWeekly();
    lastHourChecked = now.getHours();
  }
  else if (lastHourChecked !== now.getHours() && now.getHours() === whattimeofaday) {
    await PostViewsSendDaily();
    lastHourChecked = now.getHours();
  }
}

async function PostViewsSendWeekly()
{
  const entries = await LoadPosts(true);

  let res = "Топ статей по просмотрам за неделю:\n";

  entries.sort((a, b) => b.change - a.change);

  for (const entry of entries) {
    if (!entry.views || !entry.change) {
      continue;
    }

    const mark = (entry.change >= 0) ? "+" : "-";
    res += `${entry.title} - ${entry.views} (${mark}${entry.change})\n`;
  }

  await Server.SendMessage(res);

  return "";
}

async function PostViewsSendDaily()
{
  const entries = await LoadPosts();

  let res = "Топ статей по просмотрам за день:\n";

  entries.sort((a, b) => b.change - a.change);

  for (const entry of entries) {
    if (!entry.views || !entry.change) {
      continue;
    }

    const mark = (entry.change >= 0) ? "+" : "-";
    res += `${entry.title} - ${entry.views} (${mark}${entry.change})\n`;
  }

  await Server.SendMessage(res);

  return "";
}

export async function ProcessPostViews(message: MessageWrapper)
{
  if (message.checkRegex(/\/posts force/)) {
    await PostViewsSendDaily();
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