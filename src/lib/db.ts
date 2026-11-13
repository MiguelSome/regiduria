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
    this.version(3)
      .stores({
        productions: "id, title, status, syncStatus",
        cues: "id, productionId, identifier, status, executionState, scriptDocumentId",
        incidents: "id, productionId, date, status",
        performances: "id, productionId, date, title",
        scriptDocuments: "id, productionId",
        scriptLabels: "id, documentId, category, page, cueId, productionId",
      })
      .upgrade(async (transaction) => {
        const seedProjectIds = ["p-1", "p-2"];
        await transaction.table("productions").bulkDelete(seedProjectIds);
        await Promise.all([
          transaction.table("cues").where("productionId").anyOf(seedProjectIds).delete(),
          transaction.table("incidents").where("productionId").anyOf(seedProjectIds).delete(),
          transaction.table("performances").where("productionId").anyOf(seedProjectIds).delete(),
          transaction.table("scriptDocuments").where("productionId").anyOf(seedProjectIds).delete(),
          transaction.table("scriptLabels").where("productionId").anyOf(seedProjectIds).delete(),
        ]);
      });
    this.version(4)
      .stores({
        productions: "id, title, status, syncStatus",
        cues: "id, productionId, identifier, status, executionState, scriptDocumentId",
        incidents: "id, productionId, date, status",
        performances: "id, productionId, date, title",
        scriptDocuments: "id, productionId",
        scriptLabels: "id, documentId, category, page, cueId, productionId",
      })
      .upgrade(async (transaction) => {
        await transaction.table("cues").toCollection().modify((cue: Cue) => {
          if (cue.type === "PREVENIR") {
            cue.identifier = cue.identifier.replace(/^MOV(?=-)/i, "PREV");
          }
        });
        await transaction.table("scriptLabels").toCollection().modify((label: ScriptLabel) => {
          if (label.cueType === "PREVENIR") {
            if (label.cueIdentifier) {
              label.cueIdentifier = label.cueIdentifier.replace(/^MOV(?=-)/i, "PREV");
            }
            if (label.cueIdentifierOverride) {
              label.cueIdentifierOverride = label.cueIdentifierOverride.replace(/^MOV(?=-)/i, "PREV");
            }
          }
        });
      });
  }
}

export const regiduriaDb = new RegiduriaDb();
