"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Users, X } from "lucide-react";

import type {
  ArtisticTeamMember,
  DepartmentName,
  ProjectTeam,
  TechnicalDepartmentTeam,
} from "@/lib/types";

type TeamTab = "artistic" | "technical";

const technicalDepartments: DepartmentName[] = [
  "Regiduría",
  "Iluminación",
  "Sonido",
  "Maquinaria",
  "Utilería",
  "Vestuario",
  "Caracterización",
  "Vídeo",
];

const artisticRoles = [
  "Actor",
  "Actriz",
  "Dirección",
  "Ayudante de dirección",
  "Dramaturgia",
  "Escenografía",
  "Coreografía",
  "Música",
  "Otro",
];

export function createEmptyProjectTeam(): ProjectTeam {
  return {
    technical: technicalDepartments.map((department) => ({
      department,
      head: "",
      technicians: [],
    })),
    artistic: [],
  };
}

interface ProjectTeamDialogProps {
  team: ProjectTeam;
  onChange: (team: ProjectTeam) => void;
  onClose: () => void;
}

export function ProjectTeamDialog({ team, onChange, onClose }: ProjectTeamDialogProps) {
  const [activeTab, setActiveTab] = useState<TeamTab>("artistic");
  const [memberDraft, setMemberDraft] = useState({ name: "", role: "", character: "" });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const updateDepartment = (
    department: DepartmentName,
    update: (current: TechnicalDepartmentTeam) => TechnicalDepartmentTeam,
  ) => {
    const existing = team.technical.find((item) => item.department === department) ?? {
      department,
      head: "",
      technicians: [],
    };
    const updated = update(existing);
    const technical = team.technical.some((item) => item.department === department)
      ? team.technical.map((item) => item.department === department ? updated : item)
      : [...team.technical, updated];
    onChange({ ...team, technical });
  };

  const addArtisticMember = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const member: ArtisticTeamMember = {
      id: crypto.randomUUID(),
      name: memberDraft.name.trim(),
      role: memberDraft.role,
      ...(memberDraft.role === "Actor" || memberDraft.role === "Actriz"
        ? { character: memberDraft.character.trim() }
        : {}),
    };
    onChange({ ...team, artistic: [...team.artistic, member] });
    setMemberDraft({ name: "", role: "", character: "" });
  };

  const updateArtisticMember = (id: string, update: Partial<ArtisticTeamMember>) => {
    onChange({
      ...team,
      artistic: team.artistic.map((member) => {
        if (member.id !== id) return member;
        const updated = { ...member, ...update };
        if (updated.role !== "Actor" && updated.role !== "Actriz") {
          delete updated.character;
        }
        return updated;
      }),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-team-title"
        className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50"
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-cyan-500/10 p-2 text-cyan-300">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 id="project-team-title" className="font-semibold text-white">Equipo</h2>
              <p className="text-xs text-slate-400">Los cambios se guardan automáticamente.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar equipo"
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div role="tablist" aria-label="Equipo del proyecto" className="flex border-b border-slate-800 px-5">
          {([
            { id: "artistic", label: "Artístico" },
            { id: "technical", label: "Técnico" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-3 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-cyan-400 text-cyan-200"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {activeTab === "technical" ? (
            <div className="space-y-3">
              {technicalDepartments.map((department) => {
                const teamDepartment = team.technical.find((item) => item.department === department) ?? {
                  department,
                  head: "",
                  technicians: [],
                };
                return (
                  <section key={department} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <h3 className="font-medium text-white">{department}</h3>
                    <label className="mt-3 block space-y-1.5 text-sm text-slate-300">
                      <span>Jefe de departamento</span>
                      <input
                        value={teamDepartment.head}
                        onChange={(event) => updateDepartment(department, (current) => ({
                          ...current,
                          head: event.target.value,
                        }))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                        placeholder={`Nombre del jefe de ${department.toLowerCase()}`}
                      />
                    </label>

                    <div className="mt-3 space-y-2">
                      {teamDepartment.technicians.map((technician) => (
                        <div key={technician.id} className="grid gap-2 sm:grid-cols-[1fr_0.8fr_auto]">
                          <label className="space-y-1 text-xs text-slate-400">
                            <span>Técnico</span>
                            <input
                              required
                              value={technician.name}
                              onChange={(event) => updateDepartment(department, (current) => ({
                                ...current,
                                technicians: current.technicians.map((item) =>
                                  item.id === technician.id ? { ...item, name: event.target.value } : item,
                                ),
                              }))}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                              placeholder="Nombre"
                            />
                          </label>
                          <label className="space-y-1 text-xs text-slate-400">
                            <span>Etiqueta / puesto</span>
                            <input
                              required
                              value={technician.tag}
                              onChange={(event) => updateDepartment(department, (current) => ({
                                ...current,
                                technicians: current.technicians.map((item) =>
                                  item.id === technician.id ? { ...item, tag: event.target.value } : item,
                                ),
                              }))}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                              placeholder="Base, subjefe…"
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={`Quitar técnico de ${department}`}
                            onClick={() => updateDepartment(department, (current) => ({
                              ...current,
                              technicians: current.technicians.filter((item) => item.id !== technician.id),
                            }))}
                            className="mt-auto inline-flex h-10 w-10 items-center justify-center rounded-lg border border-rose-500/30 text-rose-200 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => updateDepartment(department, (current) => ({
                        ...current,
                        technicians: [
                          ...current.technicians,
                          { id: crypto.randomUUID(), name: "", tag: "Base" },
                        ],
                      }))}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500/50 hover:text-cyan-200"
                    >
                      <Plus className="h-4 w-4" />
                      Añadir técnico
                    </button>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {team.artistic.length > 0 && (
                <div className="space-y-3">
                  {team.artistic.map((member) => (
                    <section key={member.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5 text-sm text-slate-300">
                          <span>Nombre</span>
                          <input
                            required
                            value={member.name}
                            onChange={(event) => updateArtisticMember(member.id, { name: event.target.value })}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                          />
                        </label>
                        <label className="space-y-1.5 text-sm text-slate-300">
                          <span>Rol</span>
                          <select
                            required
                            value={member.role}
                            onChange={(event) => updateArtisticMember(member.id, { role: event.target.value })}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                          >
                            <option value="">Selecciona un rol</option>
                            {artisticRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                          </select>
                        </label>
                        {(member.role === "Actor" || member.role === "Actriz") && (
                          <label className="space-y-1.5 text-sm text-slate-300 sm:col-span-2">
                            <span>Personaje</span>
                            <input
                              value={member.character ?? ""}
                              onChange={(event) => updateArtisticMember(member.id, { character: event.target.value })}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                              placeholder="Nombre del personaje"
                            />
                          </label>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onChange({
                          ...team,
                          artistic: team.artistic.filter((item) => item.id !== member.id),
                        })}
                        className="mt-3 inline-flex items-center gap-2 text-xs text-rose-200 hover:text-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar integrante
                      </button>
                    </section>
                  ))}
                </div>
              )}

              <form onSubmit={addArtisticMember} className="rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-4">
                <h3 className="mb-3 text-sm font-medium text-white">Añadir integrante artístico</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm text-slate-300">
                    <span>Nombre</span>
                    <input
                      required
                      value={memberDraft.name}
                      onChange={(event) => setMemberDraft((current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                    />
                  </label>
                  <label className="space-y-1.5 text-sm text-slate-300">
                    <span>Rol</span>
                    <select
                      required
                      value={memberDraft.role}
                      onChange={(event) => setMemberDraft((current) => ({ ...current, role: event.target.value }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                    >
                      <option value="">Selecciona un rol</option>
                      {artisticRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </label>
                  {(memberDraft.role === "Actor" || memberDraft.role === "Actriz") && (
                    <label className="space-y-1.5 text-sm text-slate-300 sm:col-span-2">
                      <span>Personaje</span>
                      <input
                        value={memberDraft.character}
                        onChange={(event) => setMemberDraft((current) => ({ ...current, character: event.target.value }))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
                        placeholder="Nombre del personaje"
                      />
                    </label>
                  )}
                </div>
                <button
                  type="submit"
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                >
                  <Plus className="h-4 w-4" />
                  Añadir al equipo artístico
                </button>
              </form>
            </div>
          )}
        </div>

        <footer className="flex justify-end border-t border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            Cerrar
          </button>
        </footer>
      </section>
    </div>
  );
}
