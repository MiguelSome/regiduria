import Dexie, { type Table } from "dexie";

import type { Cue, Incident, Production } from "@/lib/types";

class RegiduriaDb extends Dexie {
  productions!: Table<Production, string>;
  cues!: Table<Cue, string>;
  incidents!: Table<Incident, string>;

  constructor() {
    super("regiduria-db");
    this.version(1).stores({
      productions: "id, title, status, syncStatus",
      cues: "id, productionId, identifier, status, executionState",
      incidents: "id, productionId, date, status",
    });
  }
}

export const regiduriaDb = new RegiduriaDb();
