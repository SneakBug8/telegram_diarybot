export class ProjectRecord
{
  public subject = "";
  public datetime: string = new Date().toString();
}

export class ProjectsData
{
  public Projects = new Array<Project>();
  public Records = new Array<ProjectRecord>();
}

export class Project
{
  public subject = "";
  public time = 0;
  public day = 0;
}