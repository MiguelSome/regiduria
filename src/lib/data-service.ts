import { regiduriaDb } from "@/lib/db";
import { cueDepartmentByType } from "@/lib/cue-presentation";
import {
  getCueIdentifierNumber,
  getCueIdentifierType,
  getNextCueIdentifier,
} from "@/lib/cue-identifiers";
import { cueSchema, scriptLabelSchema } from "@/lib/schemas";
import { cues as seedCues, incidents as seedIncidents, performances as seedPerformances, productions as seedProductions } from "@/lib/mock-data";
import type {
  Cue,
  CueType,
  Incident,
  Performance,
  Production,
  ScriptDocument,
  ScriptLabel,
  ScriptLabelDraft,
} from "@/lib/types";

function compareLabels(first: ScriptLabel, second: ScriptLabel): number {
  return first.page - second.page || first.y - second.y || first.x - second.x;
}

function assignDocumentCueIdentifiers(
  labels: ScriptLabel[],
  existingCues: Cue[],
  documentId: string,
): Map<string, string> {
  const nextNumberByType = new Map<CueType, number>();
  for (const cue of existingCues) {
    if (cue.scriptDocumentId === documentId) continue;
    if (cue.type === "PREVENIR") continue;
    const number = getCueIdentifierNumber(cue.identifier, cue.type);
    if (number !== undefined) {
      nextNumberByType.set(cue.type, Math.max(nextNumberByType.get(cue.type) ?? 0, number));
    }
  }

  const cueLabels = labels.filter(
    (label) => label.category === "cue" && label.cueType && label.cueId,
  );
  const identifiers = new Map<string, string>();

  for (const label of cueLabels) {
    if (!label.cueType || !label.cueId) {
      continue;
    }

    // Keep existing non-PDF cue numbers stable and number script cues after them.
    const overrideIdentifier = label.cueIdentifierOverride?.trim();
    const identifierType = getCueIdentifierType(label.cueType);
    let identifier: string;
    if (overrideIdentifier) {
      identifier = overrideIdentifier;
      const overrideNumber = getCueIdentifierNumber(identifier, label.cueType);
      if (overrideNumber !== undefined && label.cueType !== "PREVENIR") {
        nextNumberByType.set(
          identifierType,
          Math.max(nextNumberByType.get(identifierType) ?? 0, overrideNumber),
        );
      }
    } else {
      const currentMaximum = nextNumberByType.get(identifierType) ?? 0;
      identifier = getNextCueIdentifier(label.cueType, currentMaximum);
      if (label.cueType !== "PREVENIR") {
        const nextNumber = getCueIdentifierNumber(identifier, label.cueType);
        if (nextNumber !== undefined) {
          nextNumberByType.set(identifierType, nextNumber);
        }
      }
    }
    identifiers.set(label.id, identifier);
  }

  return identifiers;
}

async function updateDocumentCues(documentId: string): Promise<void> {
  const labels = (await regiduriaDb.scriptLabels.where("documentId").equals(documentId).toArray())
    .sort(compareLabels);
  const document = await regiduriaDb.scriptDocuments.get(documentId);
  const existingCues = document
    ? await regiduriaDb.cues.where("productionId").equals(document.productionId).toArray()
    : [];
  const identifiers = assignDocumentCueIdentifiers(labels, existingCues, documentId);

  for (const label of labels) {
    if (label.category !== "cue" || !label.cueType || !label.cueId) continue;
    const identifier = identifiers.get(label.id);
    if (!identifier) continue;

    const previousLabels = labels.filter((candidate) => compareLabels(candidate, label) <= 0);
    const actLabels = previousLabels.filter((candidate) => candidate.category === "act");
    const sceneLabels = previousLabels.filter((candidate) => candidate.category === "scene");
    const act = actLabels[actLabels.length - 1]?.title ?? "Acto I";
    const scene = sceneLabels[sceneLabels.length - 1]?.title ?? "1";

    await regiduriaDb.cues.update(label.cueId, {
      identifier,
      act,
      scene,
    });
    await regiduriaDb.scriptLabels.update(label.id, { cueIdentifier: identifier });
  }
}

export async function getNextScriptCueIdentifier(
  documentId: string,
  productionId: string,
  page: number,
  x: number,
  y: number,
  cueType: CueType,
): Promise<string> {
  const document = await regiduriaDb.scriptDocuments.get(documentId);
  if (!document || document.productionId !== productionId) {
    throw new Error("No se encontró el PDF asociado a esta etiqueta.");
  }

  const [labels, existingCues] = await Promise.all([
    regiduriaDb.scriptLabels.where("documentId").equals(documentId).toArray(),
    regiduriaDb.cues.where("productionId").equals(productionId).toArray(),
  ]);
  const pendingLabel: ScriptLabel = {
    id: crypto.randomUUID(),
    documentId,
    productionId,
    category: "cue",
    title: "",
    page,
    x,
    y,
    cueType,
    cueId: crypto.randomUUID(),
  };
  const orderedLabels = [...labels, pendingLabel].sort(compareLabels);
  const identifiers = assignDocumentCueIdentifiers(orderedLabels, existingCues, documentId);
  const identifier = identifiers.get(pendingLabel.id);
  if (!identifier) {
    throw new Error("No se pudo calcular el identificador del cue.");
  }

  return identifier;
}

export async function ensureSeedData() {
  const productionCount = await regiduriaDb.productions.count();
  if (productionCount > 0) {
    return;
  }

  await regiduriaDb.transaction("rw", regiduriaDb.productions, regiduriaDb.cues, regiduriaDb.incidents, regiduriaDb.performances, async () => {
    await regiduriaDb.productions.bulkPut(seedProductions);
    await regiduriaDb.cues.bulkPut(seedCues);
    await regiduriaDb.incidents.bulkPut(seedIncidents);
    await regiduriaDb.performances.bulkPut(seedPerformances);
  });
}

export async function getProductions(): Promise<Production[]> {
  await ensureSeedData();
  return regiduriaDb.productions.orderBy("title").toArray();
}

export async function getCuesByProduction(productionId: string): Promise<Cue[]> {
  await ensureSeedData();
  return regiduriaDb.cues.where("productionId").equals(productionId).toArray();
}

export async function getAllCues(): Promise<Cue[]> {
  await ensureSeedData();
  return regiduriaDb.cues.orderBy("identifier").toArray();
}

export async function saveProduction(production: Production): Promise<void> {
  await regiduriaDb.productions.put(production);
}

export async function deleteProduction(id: string): Promise<void> {
  await regiduriaDb.transaction(
    "rw",
    regiduriaDb.productions,
    regiduriaDb.cues,
    regiduriaDb.scriptDocuments,
    regiduriaDb.scriptLabels,
    async () => {
      await regiduriaDb.productions.delete(id);
      await regiduriaDb.cues.where("productionId").equals(id).delete();
      await regiduriaDb.scriptDocuments.delete(id);
      await regiduriaDb.scriptLabels.where("documentId").equals(id).delete();
    },
  );
}

export async function saveCue(cue: Cue): Promise<void> {
  const validatedCue = cueSchema.parse(cue);
  await regiduriaDb.transaction(
    "rw",
    regiduriaDb.cues,
    regiduriaDb.scriptLabels,
    regiduriaDb.scriptDocuments,
    async () => {
      const existing = await regiduriaDb.cues.get(validatedCue.id);
      if (!existing?.scriptDocumentId) {
        await regiduriaDb.cues.put(validatedCue);
        return;
      }

      const updatedCue: Cue = {
        ...validatedCue,
        type: existing.type,
        act: existing.act,
        scene: existing.scene,
        scriptDocumentId: existing.scriptDocumentId,
        scriptLabelId: existing.scriptLabelId,
      };
      await regiduriaDb.cues.put(updatedCue);

      if (existing.scriptLabelId) {
        await regiduriaDb.scriptLabels.update(existing.scriptLabelId, {
          title: updatedCue.description,
          pie: updatedCue.pie?.trim() ?? "",
          includedTypes: updatedCue.includedTypes,
          ...(validatedCue.identifier !== existing.identifier
            ? { cueIdentifierOverride: validatedCue.identifier.trim() }
            : {}),
        });
      }
      await updateDocumentCues(existing.scriptDocumentId);
    },
  );
}

export async function deleteCue(id: string): Promise<void> {
  await regiduriaDb.transaction(
    "rw",
    regiduriaDb.cues,
    regiduriaDb.scriptLabels,
    regiduriaDb.scriptDocuments,
    async () => {
      const cue = await regiduriaDb.cues.get(id);
      if (!cue) return;

      await regiduriaDb.cues.delete(id);
      if (cue.scriptLabelId) {
        await regiduriaDb.scriptLabels.delete(cue.scriptLabelId);
      }
      if (cue.scriptDocumentId) {
        await updateDocumentCues(cue.scriptDocumentId);
      }
    },
  );
}

export async function getScriptDocument(productionId: string): Promise<ScriptDocument | undefined> {
  return regiduriaDb.scriptDocuments.get(productionId);
}

export async function getScriptLabels(documentId: string): Promise<ScriptLabel[]> {
  return (await regiduriaDb.scriptLabels.where("documentId").equals(documentId).toArray())
    .sort(compareLabels);
}

export async function saveScriptDocument(
  productionId: string,
  fileName: string,
  pdfData: Blob,
): Promise<ScriptDocument> {
  const document: ScriptDocument = {
    id: productionId,
    productionId,
    fileName,
    displayName: fileName.replace(/\.pdf$/i, ""),
    pdfData,
    updatedAt: new Date().toISOString(),
  };

  await regiduriaDb.transaction(
    "rw",
    regiduriaDb.scriptDocuments,
    regiduriaDb.scriptLabels,
    regiduriaDb.cues,
    async () => {
      await regiduriaDb.cues.where("scriptDocumentId").equals(document.id).delete();
      await regiduriaDb.scriptLabels.where("documentId").equals(document.id).delete();
      await regiduriaDb.scriptDocuments.put(document);
    },
  );

  return document;
}

export async function renameScriptDocument(
  documentId: string,
  displayName: string,
): Promise<ScriptDocument> {
  const normalizedName = displayName.trim();
  if (!normalizedName) {
    throw new Error("El nombre del libreto no puede estar vacío.");
  }

  return regiduriaDb.transaction("rw", regiduriaDb.scriptDocuments, async () => {
    const document = await regiduriaDb.scriptDocuments.get(documentId);
    if (!document) {
      throw new Error("No se encontró el PDF que quieres renombrar.");
    }

    const updatedDocument: ScriptDocument = {
      ...document,
      displayName: normalizedName,
      updatedAt: new Date().toISOString(),
    };
    await regiduriaDb.scriptDocuments.put(updatedDocument);
    return updatedDocument;
  });
}

export async function deleteScriptDocument(productionId: string): Promise<void> {
  await regiduriaDb.transaction(
    "rw",
    regiduriaDb.scriptDocuments,
    regiduriaDb.scriptLabels,
    regiduriaDb.cues,
    async () => {
      await regiduriaDb.cues.where("scriptDocumentId").equals(productionId).delete();
      await regiduriaDb.scriptLabels.where("documentId").equals(productionId).delete();
      await regiduriaDb.scriptDocuments.delete(productionId);
    },
  );
}

export async function saveScriptLabel(draft: ScriptLabelDraft): Promise<ScriptLabel> {
  const input = scriptLabelSchema.parse(draft);
  const document = await regiduriaDb.scriptDocuments.get(input.documentId);
  if (!document || document.productionId !== input.productionId) {
    throw new Error("No se encontró el PDF asociado a esta etiqueta.");
  }

  const label: ScriptLabel = {
    ...input,
    id: crypto.randomUUID(),
  };

  await regiduriaDb.transaction(
    "rw",
    regiduriaDb.scriptLabels,
    regiduriaDb.cues,
    regiduriaDb.scriptDocuments,
    async () => {
      if (label.category === "cue" && label.cueType) {
        label.cueId = crypto.randomUUID();
        const cue: Cue = {
          id: label.cueId,
          productionId: label.productionId,
          identifier: "",
          type: label.cueType,
          includedTypes: label.includedTypes,
          description: label.title,
          pie: label.pie ?? "",
          act: "Acto I",
          scene: "1",
          department: cueDepartmentByType[label.cueType],
          observations: "",
          status: "Borrador",
          executionState: "Preparación",
          scriptDocumentId: label.documentId,
          scriptLabelId: label.id,
        };
        await regiduriaDb.cues.add(cue);
      }

      await regiduriaDb.scriptLabels.add(label);
      await updateDocumentCues(label.documentId);
    },
  );

  return label;
}

export async function deleteScriptLabel(id: string): Promise<void> {
  await regiduriaDb.transaction(
    "rw",
    regiduriaDb.scriptLabels,
    regiduriaDb.cues,
    regiduriaDb.scriptDocuments,
    async () => {
      const label = await regiduriaDb.scriptLabels.get(id);
      if (!label) {
        return;
      }

      if (label.cueId) {
        await regiduriaDb.cues.delete(label.cueId);
      }

      await regiduriaDb.scriptLabels.delete(id);
      await updateDocumentCues(label.documentId);
    },
  );
}

export async function getIncidents(): Promise<Incident[]> {
  await ensureSeedData();
  return regiduriaDb.incidents.orderBy("date").reverse().toArray();
}

export async function getPerformances(): Promise<Performance[]> {
  await ensureSeedData();
  return regiduriaDb.performances.orderBy("date").toArray();
}
