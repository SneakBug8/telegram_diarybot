const ObjectsToCsv = require("objects-to-csv");
import { Config } from "../config";
import { MIS_DT } from "../util/MIS_DT";
import { ProjectEntry } from "./ProjectEntry";

class ProjectsStatsExporterClass
{
  public async Export()
  {
    const map = new Map<number, any>();
    const path = Config.dataPath() + "/projects.csv";

    const projectentries = await ProjectEntry.GetLastYear();

    for (const entry of projectentries) {
      const mapentry = map.get(MIS_DT.RoundToDay(new Date(entry.MIS_DT))) || {};

      if (!mapentry[entry.subject]) {
        mapentry[entry.subject] = 1;
      }
      else {
        mapentry[entry.subject]++;
      }

      map.set(MIS_DT.RoundToDay(new Date(entry.MIS_DT)), mapentry);
    }

    for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 365; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
      const mapentry = map.get(i) || {};
      mapentry.mis_dt = i;

      map.set(i, mapentry);
    }

    const arr = [];

    for (const e of map) {
      arr.push(e[1]);
    }

    arr.sort((a, b) => a.mis_dt - b.mis_dt);

    await new ObjectsToCsv(Array.from(arr)).toDisk(path, { allColumns: true });

    return path;
  }
}


export const ProjectsStatsExporter = new ProjectsStatsExporterClass();