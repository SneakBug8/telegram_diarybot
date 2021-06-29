class ConfigClass
{
  // ChatIds that don't require auth
  public AllowedChats = JSON.parse(process.env.allowedchats || "") as number[];
  // Chat where bot will send notifications
  public DefaultChat = Number.parseInt(process.env.defaultchat || "", 10) as number;

  public Password = process.env.password;

  public ftphost()
  {
    return process.env.host;
  }

  public ftpuser()
  {
    return process.env.user;
  }

  public ftppassword()
  {
    return process.env.password;
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
}

export const Config = new ConfigClass();
