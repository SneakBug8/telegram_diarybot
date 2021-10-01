export class NoteChange
{
  public filename: string;
  public content: string;
  public newfile: boolean;
  public length: number;

  public constructor(filename: string, content: string, newfile: boolean = false)
  {
    this.filename = filename;
    this.content = content;
    this.newfile = newfile;
    this.length = content.length;
  }
}