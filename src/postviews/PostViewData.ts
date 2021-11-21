export class PostViewEntry
{
  public id: number | undefined;
  public title = "";
  public MIS_DT = Date.now();
  public CREATED_DT = Date.now();
  public postId = 0;
  public views = 0;
  public change = 0;
}