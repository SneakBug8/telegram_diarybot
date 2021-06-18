class ConfigClass
{
  public AllowedChats = [215850634];
  public DefaultChat = 215850634;

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
