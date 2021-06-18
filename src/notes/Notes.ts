import { Logger } from "../logger";
import { MessageWrapper } from "../MessageWrapper";
import { PublishService } from "../PublishService";

export async function ProcessNotes(message: MessageWrapper)
{
  if (message.checkRegex(/\/path/)) {
    return message.reply(`Current path: ${Logger.getFilename()}`)
      .then((newmsg) => newmsg.deleteAfterTime(1));
  }

  if (message.checkRegex(/\/publish/)) {
    return PublishService.PublishLast();
  }

  if (message.checkRegex(/\/load/)) {
    return PublishService.DownloadLast();
  }

  if (message.checkRegex(/\/space/)) {
    return Logger.Log("\n---\n", false);
  }

  if (message.checkRegex(/\/ping/)) {
    return message
      .deleteAfterTime(1)
      .reply("Pong")
      .then((newmsg) => newmsg.deleteAfterTime(1));
  }

  if (message.checkRegex(/\/reset/)) {
    Logger.ResetFile();
    return message.reply("File path reset.")
      .then((newmsg) => newmsg.deleteAfterTime(1));
  }

  if (message.checkRegex(/\/files/)) {
    Logger.listFiles();
    return message;
  }

  if (message.checkRegex(/\/file .+/)) {
    const capture = message.captureRegex(/\/file (.+)/);

    if (!capture) {
      return;
    }

    return message.reply(Logger.SetFilename(capture[1]))
      .then((newmsg) => newmsg.deleteAfterTime(1));
  }

  // today logs
  if (message.checkRegex(/^\/log$/)) {
    // const today = dateFormat(Date.now(), "yyyy-mm-dd");

    return message
      .reply(await Logger.GetLogs())
      .then((newmsg) => newmsg.deleteAfterTime(5));
  }

  if (message.checkRegex(/^\/logs$/)) {
    // const today = dateFormat(Date.now(), "yyyy-mm-dd");

    const logs = await Logger.GetLogs();
    return message
      .deleteAfterTime(1)
      .replyMany(logs.split("---"))
      .then((messages) =>
      {
        for (const newmsg of messages) {
          newmsg.deleteAfterTime(5);
        }
      });
  }

  const logregexp = new RegExp("\/get (.+)");
  if (message.checkRegex(logregexp)) {
    const filematch = message.captureRegex(logregexp);

    if (!filematch) {
      return;
    }

    return message
      .deleteAfterTime(1)
      .reply(await Logger.GetLogs(filematch[1]))
      .then((newmsg) => newmsg.deleteAfterTime(15));
  }

  const logsregexp = new RegExp("\/logs (.+)");
  if (message.checkRegex(logsregexp)) {
    const datematches = message.captureRegex(logsregexp);

    if (!datematches) {
      return;
    }

    const logs = await Logger.GetLogs(datematches[1]);
    return message.deleteAfterTime(1)
      .replyMany(logs.split("---"))
      .then((msgs) =>
      {
        for (const newmsg of msgs) {
          newmsg.deleteAfterTime(15);
        }
      });
  }

  if (message.checkRegex(/\/delete/)) {
    message.reply(await Logger.DeleteFile());
  }

  if (message.checkRegex(/\/delete (.+)/)) {
    const filename = message.captureRegex(/\/delete (.+)/);

    if (!filename) {
      return;
    }

    return message
      .deleteAfterTime(1)
      .reply(await Logger.DeleteFile(filename[1]))
      .then((newmsg) => newmsg.deleteAfterTime(1));
  }
  return false;
}