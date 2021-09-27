import { Logger } from "./logger";
import { NotesDataSave, NotesRepo } from "./Notes";
import { NotesData } from "./NotesData";

class SlotClass
{
  private slotInd = 0;

  public getSlot()
  {
    return this.slotInd;
  }

  public changeSlot(ind: number)
  {
    if (ind < 0) {
      ind = NotesRepo.Slots.size - 1;
    }
    this.slotInd = ind;
  }

  public getFilename()
  {
    if (!NotesRepo.Slots.get(this.slotInd)) {
      const i = Logger.generateFilename();
      this.setFilename(i);
      return i;
    }

    return NotesRepo.Slots.get(this.slotInd) as string;
  }

  public async getTitle()
  {
    return await Logger.getTitle(this.getFilename());
  }

  public setFilename(filename: string)
  {
    NotesRepo.Slots.set(this.slotInd, filename);
    NotesDataSave();
  }
}

export const Slots = new SlotClass();
