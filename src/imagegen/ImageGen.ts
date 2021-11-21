import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";
import { Canvas, createCanvas, loadImage, NodeCanvasRenderingContext2D } from "canvas";

import { Config } from "../config";
import { BotAPI } from "../api/bot";
import { setWaitingForValue } from "..";

export async function ImageGenProcess(message: MessageWrapper)
{
  if (message.checkRegex(/\/image/)) {
    setWaitingForValue("Текст изображения?", async (msg) =>
    {
      const text = message.message.text;

      if (!text) { return; }

      line = text[1];

      const respath = await ImageGen.Run();

      await BotAPI.sendDocument(message.message.chat.id, respath);

      /*await sleep(30000);
      fs.unlinkSync(respath);
      console.log(`Image file ${respath} deleted.`);*/
    });
  }
  return false;
}

const imagewidth = 800;
const imageheight = 600;
const canvas = createCanvas(imagewidth, imageheight);

let line = "";
let background = "";

class ImageGenClass
{
  public fontSize = 72;

  public async Run()
  {
    const ctx = canvas.getContext("2d");

    let back = this.getRandomBackground();

    if (background !== "") {
      back = background;
    }

    const image = await loadImage(back);
    ctx.drawImage(image, 0, 0, imagewidth, imageheight);

    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.rect(0, 0, imagewidth, imageheight);
    ctx.fill();

    const randombubbles = Math.floor(Math.random() * 2);
    if (randombubbles === 1) {
      this.Bubbles(ctx);
    }
    else {
      this.Bubbles2(ctx);
    }

    this.CentralText(ctx);

    this.Author(ctx);

    return await this.SaveImage(canvas);
  }

  public CentralText(ctx: NodeCanvasRenderingContext2D)
  {
    ctx.save();

    if (line.length <= 30) {
      this.fontSize = 72;
    }
    else if (line.length <= 70) {
      this.fontSize = 48;
    }
    else {
      this.fontSize = 36;
    }

    ctx.font = `${this.fontSize}px Calibri`;

    // else {
    // ctx.font = `${imagewidth / line.length}px Calibri`;
    // }
    ctx.fillStyle = "white";

    ctx.translate(imagewidth / 2, imageheight / 2);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const lines = this.fragmentText(ctx, line, canvas.width * 0.9);
    lines.forEach((tline, i) =>
    {
      ctx.fillText(tline, 0, (i - (lines.length - 1) / 2) * this.fontSize); // assume font height.
    });

    // ctx.fillText(line, 0, 0, imagewidth - 100);

    ctx.restore();
  }

  public fragmentText(ctx: NodeCanvasRenderingContext2D, text: string, maxWidth: number)
  {
    const words = text.split(new RegExp("[ \n]"));
    const lines = [];
    let tline = "";

    if (ctx.measureText(text).width < maxWidth) {
      return [text];
    }
    while (words.length > 0) {
      while (ctx.measureText(words[0]).width >= maxWidth) {
        const tmp = words[0];
        words[0] = tmp.slice(0, -1);
        if (words.length > 1) {
          words[1] = tmp.slice(-1) + words[1];
        } else {
          words.push(tmp.slice(-1));
        }
      }
      if (ctx.measureText(tline + words[0]).width < maxWidth) {
        tline += words.shift() + " ";
      } else {
        lines.push(tline);
        tline = "";
      }
      if (words.length === 0) {
        lines.push(tline);
      }
    }
    return lines;
  }

  public Author(ctx: NodeCanvasRenderingContext2D)
  {
    ctx.save();

    const author = "@SneakBug8";

    ctx.font = "36px Georgia";
    ctx.fillStyle = "white";

    ctx.translate(imagewidth - 10, imageheight - 10);
    ctx.textBaseline = "bottom";
    ctx.textAlign = "right";

    // Draw line under text
    /*const text = ctx.measureText(author);
    ctx.strokeStyle = "orange";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0 - text.width, 0);
    ctx.stroke();*/

    ctx.fillText(author, 0, 0);

    ctx.restore();
  }

  public async SaveImage(c: Canvas)
  {
    const filename = Config.dataPath() + `/res/${Date.now()}.png`;
    const out = fs.createWriteStream(filename);
    const stream = c.createPNGStream();
    stream.pipe(out);

    let finished = false;

    out.on("finish", () =>
    {
      console.log("The PNG file was created.");
      finished = true;
    });

    while (!finished) {
      await sleep(500);
    }

    return filename;
  }

  private draw(ctx: NodeCanvasRenderingContext2D)
  {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        ctx.strokeStyle = "rgb(0, " + Math.floor(255 - 42.5 * i) + ", " +
          Math.floor(255 - 42.5 * j) + ")";
        ctx.beginPath();
        ctx.arc(12.5 + j * 25, 12.5 + i * 25, 10, 0, Math.PI * 2, true);
        ctx.stroke();
      }
    }
  }

  private Bubbles(ctx: NodeCanvasRenderingContext2D)
  {
    const countx = Math.ceil(imagewidth / 25);
    const county = Math.ceil(imageheight / 25);

    const excessx = imagewidth - countx * 25;
    const excessxy = imageheight - county * 25;

    const deltax = 255 / countx;
    const deltay = 255 / county;

    for (let i = 0; i < county; i++) {
      for (let j = 0; j < countx; j++) {
        ctx.save();

        ctx.strokeStyle = "rgba(0, " + Math.floor(255 - deltay * i) + ", " +
          Math.floor(255 - deltax * j) + ", 0.15)";
        ctx.fillStyle = "rgba(0, " + Math.floor(255 - deltay * i) + ", " +
          Math.floor(255 - deltax * j) + ", 0.15)";
        ctx.beginPath();

        ctx.translate(excessx / 2, excessxy / 2);

        ctx.arc(12.5 + j * 25, 12.5 + i * 25, 10, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.restore();
      }
    }
  }

  private Bubbles2(ctx: NodeCanvasRenderingContext2D)
  {
    const countx = Math.ceil(imagewidth / 25);
    const county = Math.ceil(imageheight / 25);

    const excessx = imagewidth - countx * 25;
    const excessxy = imageheight - county * 25;

    const deltax = 255 / countx;
    const deltay = 255 / county;

    for (let i = 0; i < county; i++) {
      for (let j = 0; j < countx; j++) {
        ctx.save();

        ctx.strokeStyle = "rgba(" + Math.floor(255 - deltay * i) + ", 0,  " +
          Math.floor(255 - deltax * j) + ", 0.15)";
        ctx.fillStyle = "rgba(" + Math.floor(255 - deltay * i) + ", 0 , " +
          Math.floor(255 - deltax * j) + ", 0.15)";
        ctx.beginPath();

        ctx.translate(excessx / 2, excessxy / 2);

        ctx.arc(12.5 + j * 25, 12.5 + i * 25, 10, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.restore();
      }
    }
  }

  private getRandomBackground()
  {
    const f = path.resolve(Config.dataPath() + "/backgrounds");
    const files = fs.readdirSync(f);

    const ind = Math.floor(Math.random() * files.length);

    return path.resolve(f, files[ind]);
  }
}

export const ImageGen = new ImageGenClass();

/*const stdin = process.openStdin();

let mode = 0;
stdin.addListener("data", async (d) =>
{
    const input = d.toString().trim();
    if (input === "0") {
        mode = 0;
        console.log("Switched mode to manual text input & random background");
        return;
    }
    if (input === "1") {
        mode = 1;
        console.log("Switched mode to read lines from file mode");
        return;
    }
    if (input === "/b") {
        mode = 3;
        console.log("Insert background name");
        return;
    }

    if (mode === 0) {
        line = input;
        Server.Run();
        return;
    }
    if (mode === 1) {
        await readLines(input);
        return;
    }
    if (mode === 3) {
        background = input;
        return;
    }
});

async function readLines(filename: string)
{
    const f = path.resolve(Config.dataPath() + "/files", filename);

    if (!fs.existsSync(f)) {
        console.log("No such file");
    }

    const file = fs.readFileSync(f);
    const lines = JSON.parse(file.toString()) as string[];

    for (const l of lines) {
        console.log(l);

        line = l;
        await Server.Run();
        await sleep(1000);
    }

    console.log("---");
    console.log(`Finished making ${lines.length} images`);
}*/

function sleep(ms: number)
{
  return new Promise((resolve) =>
  {
    setTimeout(resolve, ms);
  });
}
