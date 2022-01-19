import { Connection } from "../Database";

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
  public Id: number | undefined;
  public subject = "";
  public time = 0;
  public days: number[] = [];

  public planPerWeek = 1;

  public suggestedTimes = 0;
  public doneTimes = 0;

  public static async GetWithSubject(subj: string)
  {
    return await ProjectsRepository().where("subject", subj).select();
  }

  public static async GetById(id: number)
  {
    const entries = await ProjectsRepository().where("Id", id).select();
    return (entries.length) ? entries[0] : null;
  }

  public static async All()
  {
    return await ProjectsRepository().select();
  }

  public static async Insert(entry: Project)
  {
    return ProjectsRepository().insert(entry);
  }

  public static async Update(entry: Project)
  {
    return ProjectsRepository().where("Id", entry.Id).update(entry);
  }
}

export const ProjectsRepository = () => Connection<Project>("Projects");
