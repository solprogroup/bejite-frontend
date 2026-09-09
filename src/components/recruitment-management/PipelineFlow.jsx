import React, { useRef, useState } from "react";
import { FaUserFriends, FaPlus, FaGripVertical, FaTrash } from "react-icons/fa";

export default function PipelineFlow({
  stages = [],
  onAddStage,
  onDeleteStage,
  onReorderStages,
  readOnly = false,
}) {
  const stageItems = stages || [];
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const dragIndexRef = useRef(null);
  const canReorder = !readOnly && typeof onReorderStages === "function";
  const canDelete = !readOnly && typeof onDeleteStage === "function";

  const commitReorder = (fromIndex, toIndex) => {
    if (
      fromIndex == null ||
      toIndex == null ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= stageItems.length ||
      toIndex >= stageItems.length
    ) {
      return;
    }
    const next = [...stageItems];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorderStages(next);
  };

  const handleDragStart = (index, event) => {
    if (!canReorder) return;
    dragIndexRef.current = index;
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = "0.55";
    }
  };

  const handleDragEnd = (event) => {
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = "";
    }
    dragIndexRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragOver = (index, event) => {
    if (!canReorder || dragIndexRef.current == null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (overIndex !== index) setOverIndex(index);
  };

  const handleDrop = (index, event) => {
    if (!canReorder) return;
    event.preventDefault();
    const from =
      dragIndexRef.current ??
      Number(event.dataTransfer.getData("text/plain"));
    commitReorder(from, index);
    dragIndexRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div
      data-tour-id="rm-pipeline"
      className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 shadow-sm min-w-0"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 mb-4">
        <div className="text-xs font-extrabold tracking-wider text-gray-700 uppercase">
          Pipeline Progression Flow
        </div>
        {canReorder && (
          <p className="text-[11px] text-gray-500 font-medium">
            Drag cards to restructure the flow
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stageItems.map((stg, index) => {
          const isDragging = dragIndex === index;
          const isDropTarget = overIndex === index && dragIndex !== index;
          const stageName = stg.name || stg.title || "Stage";

          return (
            <div
              key={stg.id}
              draggable={canReorder}
              onDragStart={(e) => handleDragStart(index, e)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(index, e)}
              onDrop={(e) => handleDrop(index, e)}
              className={`bg-white border-2 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[105px] sm:min-h-[110px] min-w-0 shadow-xs relative transition-all gap-2 ${
                isDragging
                  ? "opacity-55 border-[#16730F] ring-2 ring-[#16730F]/20"
                  : isDropTarget
                    ? "border-[#16730F] bg-[#F0F7F1] shadow-md"
                    : "border-[#16730F] hover:shadow-md"
              } ${canReorder ? "cursor-grab active:cursor-grabbing" : ""}`}
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  {canReorder && (
                    <span className="text-gray-400 shrink-0" aria-hidden>
                      <FaGripVertical className="w-3 h-3" />
                    </span>
                  )}
                  <span className="inline-flex items-center justify-center bg-[#E6F4EA] text-[#16730F] text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0">
                    {stg.step || String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    title={`Delete ${stageName}`}
                    aria-label={`Delete ${stageName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteStage(stg);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-7 h-7 rounded-full bg-red-50 text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white flex items-center justify-center transition-colors shrink-0"
                  >
                    <FaTrash className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              <div className="min-w-0">
                <div className="text-sm sm:text-base font-extrabold text-[#1A3E32] tracking-tight break-words">
                  {stageName}
                </div>
                <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                  <FaUserFriends className="text-[#16730F] text-xs shrink-0" />
                  <span>
                    <strong className="text-gray-800">{stg.count}</strong>{" "}
                    candidates
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {typeof onAddStage === "function" && (
          <button
            type="button"
            onClick={onAddStage}
            className="bg-[#F8FAF9] border-2 border-dashed border-[#8EB398] hover:border-[#16730F] hover:bg-[#EEF5F0] rounded-2xl p-4 flex flex-col items-center justify-center min-h-[105px] sm:min-h-[110px] transition-all group active:scale-98"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#16730F] group-hover:bg-[#16730F] group-hover:text-white flex items-center justify-center text-sm font-bold transition-colors mb-1">
              <FaPlus />
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#1A3E32] group-hover:text-[#16730F]">
              Add Stage
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

