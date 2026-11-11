import Dexie, { type Table } from "dexie";

import type {
  Cue,
  Incident,
  Performance,
  Production,
  ScriptDocument,
  ScriptLabel,
} from "@/lib/types";

class RegiduriaDb extends Dexie {
  productions!: Table<Production, string>;
  cues!: Table<Cue, string>;
  incidents!: Table<Incident, string>;
  performances!: Table<Performance, string>;
  scriptDocuments!: Table<ScriptDocument, string>;
  scriptLabels!: Table<ScriptLabel, string>;

  constructor() {
    super("regiduria-db");
    this.version(1).stores({
      productions: "id, title, status, syncStatus",
      cues: "id, productionId, identifier, status, executionState",
      incidents: "id, productionId, date, status",
      performances: "id, productionId, date, title",
    });
    this.version(2).stores({
      productions: "id, title, status, syncStatus",
      cues: "id, productionId, identifier, status, executionState, scriptDocumentId",
      incidents: "id, productionId, date, status",
      performances: "id, productionId, date, title",
      scriptDocuments: "id, productionId",
      scriptLabels: "id, documentId, category, page, cueId",
    });
  }
}

export const regiduriaDb = new RegiduriaDb();
