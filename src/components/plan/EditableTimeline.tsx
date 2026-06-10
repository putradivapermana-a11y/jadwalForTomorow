"use client";

import { useState } from "react";
import { ScheduleBlock, BlockStatus } from "@prisma/client";
import { formatJakarta } from "@/lib/schedule/date-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Clock, Lock, Unlock, Edit2, Check, X, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { 
  editBlockAction, 
  setBlockStatusAction, 
  toggleBlockLockAction, 
  archiveBlockAction,
  safeRegeneratePlanAction
} from "@/app/plan/[date]/actions";

export function EditableTimeline({ blocks, planId, dateStr }: { blocks: ScheduleBlock[], planId: string, dateStr: string }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", startTime: "", endTime: "", category: "" });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Exclude ARCHIVED blocks from view
  const visibleBlocks = blocks.filter(b => {
    const effectiveStatus = b.status || "ACTIVE";
    return effectiveStatus !== "ARCHIVED";
  });

  const handleEditClick = (b: ScheduleBlock) => {
    setEditingId(b.id);
    setEditForm({
      title: b.title,
      category: b.category || "",
      startTime: formatJakarta(b.startTime, "HH:mm"),
      endTime: formatJakarta(b.endTime, "HH:mm")
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (b: ScheduleBlock) => {
    if (!editForm.title.trim() || !editForm.startTime || !editForm.endTime) {
      toast.error("Semua field wajib diisi");
      return;
    }

    // construct new dates safely without browser local timezone drift
    // we use the provided dateStr (YYYY-MM-DD) from props, since the plan is bound to that date
    // the safest way to rebuild for server is to just send the ISO-like string and let server parse, 
    // or manually build UTC that aligns to Jakarta. But since editBlockAction takes Date object from client:
    const newStart = new Date(`${dateStr}T${editForm.startTime}:00+07:00`);
    const newEnd = new Date(`${dateStr}T${editForm.endTime}:00+07:00`);

    if (newStart >= newEnd) {
      toast.error("Waktu mulai harus sebelum waktu selesai");
      return;
    }

    setLoadingId(b.id);
    try {
      const res = await editBlockAction(b.id, {
        title: editForm.title,
        category: editForm.category || null,
        startTime: newStart,
        endTime: newEnd
      }, dateStr);

      if (res.success) {
        toast.success("Block updated");
        setEditingId(null);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Gagal update block");
    } finally {
      setLoadingId(null);
    }
  };

  const handleStatusChange = async (id: string, status: BlockStatus) => {
    setLoadingId(id);
    try {
      const res = await setBlockStatusAction(id, status, dateStr);
      if (res.success) {
        toast.success(`Status updated to ${status}`);
      } else {
        toast.error(res.message);
      }
    } finally {
      setLoadingId(null);
    }
  };

  const handleToggleLock = async (id: string, currentLock: boolean) => {
    setLoadingId(id);
    try {
      const res = await toggleBlockLockAction(id, !currentLock, dateStr);
      if (res.success) {
        toast.success(currentLock ? "Block unlocked" : "Block locked");
      } else {
        toast.error(res.message);
      }
    } finally {
      setLoadingId(null);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Yakin mau hapus (archive) block ini?")) return;
    setLoadingId(id);
    try {
      const res = await archiveBlockAction(id, dateStr);
      if (res.success) {
        toast.success("Block dihapus dari jadwal");
      } else {
        toast.error(res.message);
      }
    } finally {
      setLoadingId(null);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm("Regenerate jadwal? Block yang di-lock dan fixed event bakal dipertahankan. Sisanya bisa kegeser.")) return;
    setIsRegenerating(true);
    try {
      const res = await safeRegeneratePlanAction(planId, dateStr);
      if (res.success) {
        toast.success("Jadwal di-generate ulang");
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end mb-4">
        <Button onClick={handleRegenerate} disabled={isRegenerating} variant="secondary">
          <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
          {isRegenerating ? "Regenerating..." : "Regenerate Unlocked"}
        </Button>
      </div>

      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
        {visibleBlocks.map((block) => {
          const isFixed = block.blockType === "FIXED_EVENT";
          const isTask = block.blockType === "TASK";
          const isWindDown = block.blockType === "WIND_DOWN";
          const isEditing = editingId === block.id;
          const isLoading = loadingId === block.id;
          const effectiveStatus = block.status || "ACTIVE";

          let statusColor = "bg-card";
          if (effectiveStatus === "DONE") statusColor = "bg-green-500/10 border-green-500/50";
          if (effectiveStatus === "SKIPPED") statusColor = "bg-orange-500/10 border-orange-500/50";
          if (effectiveStatus === "CANCELLED") statusColor = "bg-red-500/10 border-red-500/50";

          return (
            <div key={block.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border border-background bg-muted text-muted-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                {isFixed && <CalendarIcon className="w-4 h-4" />}
                {isTask && <Clock className="w-4 h-4" />}
                {isWindDown && <Lock className="w-4 h-4" />}
              </div>

              <Card className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] shadow-sm transition-colors ${statusColor} ${isLoading ? "opacity-50" : ""}`}>
                {isEditing ? (
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Title</label>
                      <Input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
                    </div>
                    <div className="flex gap-2">
                      <div className="space-y-1 flex-1">
                        <label className="text-xs text-muted-foreground">Start</label>
                        <Input type="time" value={editForm.startTime} onChange={e => setEditForm({...editForm, startTime: e.target.value})} />
                      </div>
                      <div className="space-y-1 flex-1">
                        <label className="text-xs text-muted-foreground">End</label>
                        <Input type="time" value={editForm.endTime} onChange={e => setEditForm({...editForm, endTime: e.target.value})} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                      <Button size="sm" onClick={() => handleSaveEdit(block)}>Save</Button>
                    </div>
                  </CardContent>
                ) : (
                  <>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className={effectiveStatus !== "ACTIVE" ? "line-through text-muted-foreground" : ""}>
                          {block.title}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => handleToggleLock(block.id, block.isLocked)}
                            title={block.isLocked ? "Unlock block" : "Lock block time"}
                            disabled={isFixed} // can't unlock fixed
                          >
                            {block.isLocked ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Unlock className="w-3 h-3 text-muted-foreground/30" />}
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 px-4 pt-0 text-sm text-muted-foreground flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={isFixed ? "default" : "outline"}>
                          {formatJakarta(block.startTime, "HH:mm")} - {formatJakarta(block.endTime, "HH:mm")}
                        </Badge>
                        <span className="text-xs uppercase tracking-wider">{block.blockType.replace("_", " ")}</span>
                        {effectiveStatus !== "ACTIVE" && (
                          <Badge variant="secondary" className="ml-auto">{effectiveStatus}</Badge>
                        )}
                      </div>

                      {/* Action row */}
                      <div className="flex flex-wrap items-center gap-2 border-t pt-2 mt-1">
                        {effectiveStatus === "ACTIVE" ? (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleStatusChange(block.id, "DONE")}>
                              <Check className="w-3 h-3 mr-1" /> Done
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={() => handleStatusChange(block.id, "SKIPPED")}>
                              Skipped
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleStatusChange(block.id, "CANCELLED")}>
                              <X className="w-3 h-3 mr-1" /> Cancel
                            </Button>
                            <div className="flex-1" />
                            {!block.isLocked && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEditClick(block)}>
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            )}
                            {!isFixed && !block.isLocked && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleArchive(block.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleStatusChange(block.id, "ACTIVE")}>
                              <RefreshCw className="w-3 h-3 mr-1" /> Restore Active
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}