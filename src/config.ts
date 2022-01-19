import { FindMyIp } from "./util/FindMyIp";

class ConfigClass
{
  // ChatIds that don't require auth
  public AllowedChats = JSON.parse(process.env.allowedchats || "") as number[];
  // Chat where bot will send notifications
  public DefaultChat = Number.parseInt(process.env.defaultchat || "", 10) as number;

  public Password = process.env.password;

  public ftphost()
  {
    return process.env.ftphost;
  }

  public ftpuser()
  {
    return process.env.ftpuser;
  }

  public ftppassword()
  {
    return process.env.ftppassword;
  }

  public basePath(): string
  {
    return __dirname;
  }

  public projectPath(): string
  {
    return __dirname + "/..";
  }

  public dataPath(): string
  {
    return __dirname + "/../data";
  }

  private cachedIp = "";

  public async ip()
  {
    if (this.cachedIp) {
      return this.cachedIp;
    }

    const ip = await FindMyIp.Ipify();
    this.cachedIp = ip;
    return ip;
  }

  public port()
  {
    return 3000;
  }

  public async url()
  {
    return `http://${await this.ip()}:${this.port()}/`;
  }
}

export const Config = new ConfigClass();
