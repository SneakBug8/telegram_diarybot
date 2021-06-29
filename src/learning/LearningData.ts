export class LearningRecord
{
  public from = 0;
  public to = 0;
  public subject = ""
}

export class LearningData
{
  public Timetable = new Array<LearningTimeEntry>();
  public Records = new Array<LearningRecord>();
}

export class LearningTimeEntry
{
  public subject = "";
  public time = 0;
  public day = 0;
}