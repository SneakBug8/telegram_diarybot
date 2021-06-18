class ConfigClass
{
  public AllowedChats = [215850634];
  public DefaultChat = 215850634;

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
