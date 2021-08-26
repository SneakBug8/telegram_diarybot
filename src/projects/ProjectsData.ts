export class ProjectRecord
{
  public subject = "";
  public datetime: string = new Date().toString();
}

export class ProjectsData
{
  public Projects = new Array<Project>();
  public TotalDays = 0;
}

export class Project
{
  public subject = "";
  public time = 0;
  public day = 0;

  public suggestedTimes = 0;
  public doneTimes = 0;
}