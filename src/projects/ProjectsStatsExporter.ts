const ObjectsToCsv = require("objects-to-csv");
import { WebApi } from "../api/web";
import { Config } from "../config";
import { MIS_DT } from "../util/MIS_DT";
import { ProjectEntry } from "./ProjectEntry";
import * as express from "express";
import { Color } from "../util/Color";
import { Project } from "./ProjectsData";

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

  public Init()
  {
    WebApi.app.get("/projects", this.OnProjects);
    WebApi.app.get("/projects/stats", this.OnProjectsStats);
    WebApi.app.get("/project/count", this.OnProjectsCount);
    WebApi.app.get("/project/:id", this.OnProjectStats);
  }

  public async OnProjects(req: express.Request, res: express.Response)
  {
    res.json(await ProjectEntry.All());
  }

  public async OnProjectsCount(req: express.Request, res: express.Response)
  {
    res.json((await Project.All()).length);
  }

  public async OnProjectsStats(req: express.Request, res: express.Response)
  {
    const projectentries = await ProjectEntry.GetLastMonth();
    const projects = await ProjectEntry.Projects();

    const map = new Map<string, number[]>();

    for (const proj of await projects) {
      const arr = new Array<number>();

      let sum = 0;

      for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 30; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
        const entry = projectentries.filter((x) => MIS_DT.RoundToDay(new Date(x.MIS_DT)) === i &&
          x.subject === proj.subject);

        sum += entry.length;

        arr.push(sum /*entry.length*/);
      }
      // console.log(`${proj.subject}: ${arr}`);
      map.set(proj.subject, arr);
    }

    const datasets = new Array<object>();

    let i = 0;
    for (const e of map) {
      datasets.push({
        label: e[0],
        data: e[1],
        borderColor: Color.GetColor(i),
      });
      i++;
    }

    const labels = [];

    for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 30; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
      labels.push(MIS_DT.FormatDate(i));
    }

    res.json({ datasets, labels });
  }

  public async OnProjectStats(req: express.Request, res: express.Response)
  {
    const id = req.params.id;
    const proj = await Project.GetById(Number.parseInt(id, 10));

    if (!proj) {
      return;
    }
    const projectentries = await ProjectEntry.GetLastMonthWithSubject(proj?.subject);
    const arr = new Array<number>();
    const planned = new Array<number>();

    let sum = 0;
    let plannedsum = 0;

    const planneddays = new Array<number>();
    const part = 7 / proj.planPerWeek;

    for (let i = 0; i < proj.planPerWeek; i++) {
      planneddays.push(Math.round(i * part));
    }

    for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 30; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
      const entry = projectentries.filter((x) => MIS_DT.RoundToDay(new Date(x.MIS_DT)) === i &&
        x.subject === proj.subject);

      sum += entry.length;

      //if (Math.ceil(i / MIS_DT.OneDay()) % 7 === 0) {
      if (planneddays.includes(Math.ceil(i / MIS_DT.OneDay()) % 7)) {
        // plannedsum += proj.planPerWeek;
        plannedsum += (proj.planPerWeek % 1) || 1;
      }

      planned.push(plannedsum);
      arr.push(sum /*entry.length*/);
    }
    // console.log(`${proj.subject}: ${arr}`);

    const datasets = new Array<object>();

    datasets.push({
      label: proj.subject,
      data: arr,
      borderColor: Color.GetColor(0),
      fill: "origin",
      backgroundColor: Color.GetBackground(0)
    });
    datasets.push({
      label: "Planned",
      data: planned,
      borderColor: Color.GetColor(1),
      fill: "origin",
      backgroundColor: Color.GetBackground(1)
    });

    const labels = [];

    for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 30; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
      labels.push(MIS_DT.FormatDate(i));
    }

    res.json({ datasets, labels });
  }
}


export const ProjectsStatsExporter = new ProjectsStatsExporterClass();