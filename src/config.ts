class ConfigClass
{
  // ChatIds that don't require auth
  public AllowedChats = [215850634];
  // Chat where bot will send notifications
  public DefaultChat = 215850634;

  public Password = "1122";

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
