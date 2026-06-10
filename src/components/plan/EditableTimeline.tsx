"use client";

import { useState } from "react";
import { ScheduleBlock, BlockStatus } from "@prisma/client";
import { formatJakarta } from "@/lib/schedule/date-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Clock, Lock, Unlock, Edit2, Check, X, RefreshCw, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { 
  editBlockAction, 
  setBlockStatusAction, 
  toggleBlockLockAction, 
  archiveBlockAction,
  safeRegeneratePlanAction
} from "@/app/plan/[date]/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        toast.success("Block diupdate");
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
        toast.success(`Status jadi ${status}`);
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
    if (!confirm("Hapus block ini?")) return;
    setLoadingId(id);
    try {
      const res = await archiveBlockAction(id, dateStr);
      if (res.success) {
        toast.success("Block dihapus");
      } else {
        toast.error(res.message);
      }
    } finally {
      setLoadingId(null);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm("Regenerate jadwal? Block fixed dan locked akan dipertahankan.")) return;
    setIsRegenerating(true);
    try {
      const res = await safeRegeneratePlanAction(planId, dateStr);
      if (res.success) {
        toast.success("Jadwal diregenerate");
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-2">
        <Button onClick={handleRegenerate} disabled={isRegenerating} variant="secondary" size="sm" className="h-8 gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
          {isRegenerating ? "Regenerating..." : "Regenerate AI"}
        </Button>
      </div>

      <div className="relative space-y-4 before:absolute before:inset-0 before:ml-12 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/50 before:to-transparent">
        {visibleBlocks.map((block) => {
          const isFixed = block.blockType === "FIXED_EVENT";
          const isTask = block.blockType === "TASK";
          const isWindDown = block.blockType === "WIND_DOWN";
          const isEditing = editingId === block.id;
          const isLoading = loadingId === block.id;
          const effectiveStatus = block.status || "ACTIVE";

          let statusColor = "bg-card";
          let borderStyle = "border-none shadow-sm";
          let opacityStyle = "";
          
          if (effectiveStatus === "DONE") {
            statusColor = "bg-green-500/5";
            borderStyle = "border border-green-500/20";
          }
          if (effectiveStatus === "SKIPPED" || effectiveStatus === "CANCELLED") {
            statusColor = "bg-muted/30";
            borderStyle = "border-none";
            opacityStyle = "opacity-75";
          }

          const startStr = formatJakarta(block.startTime, "HH:mm");

          return (
            <div key={block.id} className={`relative flex items-start gap-4 ${isLoading ? "opacity-50" : opacityStyle}`}>
              
              {/* Left Column: Time */}
              <div className="w-16 shrink-0 flex flex-col items-end pt-1">
                <span className="text-sm font-semibold leading-none">{startStr}</span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {Math.round((new Date(block.endTime).getTime() - new Date(block.startTime).getTime()) / 60000)}m
                </span>
              </div>

              {/* Center Dot (on top of the line) */}
              <div className="absolute left-[3rem] w-3 h-3 rounded-full border-2 border-background bg-primary z-10 translate-y-1.5 shadow-sm" />

              {/* Right Column: Card */}
              <Card className={`flex-1 overflow-hidden transition-colors ${statusColor} ${borderStyle}`}>
                {isEditing ? (
                  <CardContent className="p-3 space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Title</label>
                      <Input className="h-8 text-sm" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
                    </div>
                    <div className="flex gap-2">
                      <div className="space-y-1 flex-1">
                        <label className="text-[10px] uppercase text-muted-foreground font-semibold">Start</label>
                        <Input className="h-8 text-sm" type="time" value={editForm.startTime} onChange={e => setEditForm({...editForm, startTime: e.target.value})} />
                      </div>
                      <div className="space-y-1 flex-1">
                        <label className="text-[10px] uppercase text-muted-foreground font-semibold">End</label>
                        <Input className="h-8 text-sm" type="time" value={editForm.endTime} onChange={e => setEditForm({...editForm, endTime: e.target.value})} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCancelEdit}>Cancel</Button>
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEdit(block)}>Save</Button>
                    </div>
                  </CardContent>
                ) : (
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isFixed && <CalendarIcon className="w-3 h-3 text-primary" />}
                          {isTask && <Clock className="w-3 h-3 text-primary" />}
                          {isWindDown && <Lock className="w-3 h-3 text-muted-foreground" />}
                          <span className={`text-sm font-semibold leading-tight ${effectiveStatus !== "ACTIVE" ? "line-through text-muted-foreground" : ""}`}>
                            {block.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded-sm">
                            {block.blockType.replace("_", " ")}
                          </span>
                          {effectiveStatus !== "ACTIVE" && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-background">
                              {effectiveStatus}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        {effectiveStatus === "ACTIVE" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-accent shrink-0">
                              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => handleStatusChange(block.id, "DONE")} className="text-green-600">
                                <Check className="w-4 h-4 mr-2" /> Mark Done
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(block.id, "SKIPPED")} className="text-orange-600">
                                Skip
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(block.id, "CANCELLED")} className="text-red-600">
                                <X className="w-4 h-4 mr-2" /> Cancel
                              </DropdownMenuItem>
                              {!block.isLocked && (
                                <DropdownMenuItem onClick={() => handleEditClick(block)}>
                                  <Edit2 className="w-4 h-4 mr-2" /> Edit Time
                                </DropdownMenuItem>
                              )}
                              {!isFixed && (
                                <DropdownMenuItem onClick={() => handleToggleLock(block.id, block.isLocked)}>
                                  {block.isLocked ? <Unlock className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />} 
                                  {block.isLocked ? "Unlock" : "Lock"}
                                </DropdownMenuItem>
                              )}
                              {!isFixed && !block.isLocked && (
                                <DropdownMenuItem onClick={() => handleArchive(block.id)} className="text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {effectiveStatus !== "ACTIVE" && (
                           <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleStatusChange(block.id, "ACTIVE")}>
                             <RefreshCw className="w-3 h-3 text-muted-foreground" />
                           </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}