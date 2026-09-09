import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaSearch, FaCalendarAlt, FaTimes } from "react-icons/fa";
import { RecruiterSelect } from "../recruiter/recruiterOnboardingUi";
import {
  getPortaledMenuStyle,
  usePortaledMenu,
} from "../../hooks/usePortaledMenu";

const formatChipDate = (isoDay) => {
  if (!isoDay) return "";
  const date = new Date(`${isoDay}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDay;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const buildDateRangeLabel = (dateFrom, dateTo) => {
  if (dateFrom && dateTo) {
    return `${formatChipDate(dateFrom)} - ${formatChipDate(dateTo)}`;
  }
  if (dateFrom) return `From ${formatChipDate(dateFrom)}`;
  if (dateTo) return `Until ${formatChipDate(dateTo)}`;
  return "Select dates";
};

export default function RecruitmentFilterBar({
  searchQuery = "",
  onSearchChange,
  statusFilter = "all",
  onStatusChange,
  positionFilter = "all",
  onPositionChange,
  stageFilter = "all",
  onStageChange,
  dateFrom = "",
  dateTo = "",
  onDateFromChange,
  onDateToChange,
  onClearDate,
  dateRange,
  onApply,
  onReset,
  searchPlaceholder = "Search exercises...",
  statusOptions = [
    { label: "All Statuses", value: "all" },
    { label: "Open", value: "open" },
    { label: "Final Stage", value: "final_stage" },
    { label: "Closed", value: "closed" },
  ],
  positionOptions = [
    { label: "All Positions", value: "all" },
    { label: "Backend Engineer", value: "backend_engineer" },
    { label: "Product Designer", value: "product_designer" },
    { label: "Ops Associate", value: "ops_associate" },
    { label: "Data Analyst", value: "data_analyst" },
  ],
  stageOptions = [
    { label: "All Stages", value: "all" },
    { label: "Stage 1: Screening", value: "screening" },
    { label: "Stage 2: Tech Interview", value: "tech_interview" },
    { label: "Final: Offer", value: "final_offer" },
    { label: "Hired", value: "hired" },
  ],
  showDateFilter = true,
  tourId,
}) {
  const [isDateOpen, setIsDateOpen] = useState(false);
  const datePanelRef = useRef(null);
  const { triggerRef, menuRef, menuPos } = usePortaledMenu({
    isOpen: isDateOpen,
    onClose: () => setIsDateOpen(false),
    minWidth: 288,
    maxHeight: 320,
    extraContainRefs: [datePanelRef],
  });
  const hasDateRange = Boolean(dateFrom || dateTo);
  const chipLabel =
    dateRange ||
    (hasDateRange
      ? buildDateRangeLabel(dateFrom, dateTo)
      : "Select dates");

  return (
    <div
      data-tour-id={tourId || undefined}
      className="bg-[#EFF5F2] border border-[#D5E5DD] p-3 sm:p-4 rounded-2xl flex flex-col xl:flex-row items-stretch xl:items-center gap-2.5 sm:gap-3 shadow-xs"
    >
      {/* Search Input */}
      <div className="relative flex-1 min-w-0">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          <FaSearch />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-white text-gray-800 text-xs sm:text-sm pl-9 pr-4 py-2 sm:py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#16730F]/40 placeholder:text-gray-400 font-medium transition-all shadow-xs"
        />
      </div>

      {/* Filter Selects & Controls Container */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status Filter */}
        {statusOptions && (
          <div className="min-w-[130px]">
            <RecruiterSelect
              value={statusFilter}
              onChange={(e) => onStatusChange && onStatusChange(e.target.value)}
              options={statusOptions}
            />
          </div>
        )}

        {/* Position Filter */}
        {positionOptions && (
          <div className="min-w-[130px]">
            <RecruiterSelect
              value={positionFilter}
              onChange={(e) => onPositionChange && onPositionChange(e.target.value)}
              options={positionOptions}
            />
          </div>
        )}

        {/* Stage Filter */}
        {stageOptions && (
          <div className="min-w-[130px]">
            <RecruiterSelect
              value={stageFilter}
              onChange={(e) => onStageChange && onStageChange(e.target.value)}
              options={stageOptions}
            />
          </div>
        )}

        {/* Date range chip + picker */}
        {showDateFilter && (
          <div className="relative" ref={datePanelRef}>
            <div
              className={`inline-flex items-center gap-1.5 bg-white border text-xs font-medium px-3 py-2 rounded-xl shadow-xs ${
                hasDateRange
                  ? "border-[#16730F] text-[#1A3E32]"
                  : "border-gray-200 text-gray-700"
              }`}
            >
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsDateOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 focus:outline-none"
                aria-expanded={isDateOpen}
                aria-label="Filter by date range"
              >
                <FaCalendarAlt
                  className={`text-xs ${
                    hasDateRange ? "text-[#16730F]" : "text-gray-400"
                  }`}
                />
                <span className="whitespace-nowrap">{chipLabel}</span>
              </button>
              {hasDateRange && onClearDate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearDate();
                    setIsDateOpen(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 ml-0.5 focus:outline-none"
                  aria-label="Clear date range"
                >
                  <FaTimes className="w-3 h-3" />
                </button>
              )}
            </div>

            {isDateOpen &&
              menuPos &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  ref={menuRef}
                  className="bg-white border border-gray-200 rounded-2xl shadow-lg p-3 space-y-3"
                  style={getPortaledMenuStyle(menuPos)}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Created date range
                  </div>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-gray-600">
                      From
                    </span>
                    <input
                      type="date"
                      value={dateFrom || ""}
                      max={dateTo || undefined}
                      onChange={(e) =>
                        onDateFromChange && onDateFromChange(e.target.value)
                      }
                      className="w-full bg-[#F8FAF9] border border-gray-200 text-gray-800 text-xs font-medium px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16730F]/40"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-gray-600">To</span>
                    <input
                      type="date"
                      value={dateTo || ""}
                      min={dateFrom || undefined}
                      onChange={(e) =>
                        onDateToChange && onDateToChange(e.target.value)
                      }
                      className="w-full bg-[#F8FAF9] border border-gray-200 text-gray-800 text-xs font-medium px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16730F]/40"
                    />
                  </label>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    {onClearDate && (
                      <button
                        type="button"
                        onClick={() => {
                          onClearDate();
                        }}
                        className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2 py-1"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsDateOpen(false)}
                      className="bg-[#16730F] hover:bg-[#125B0C] text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                    >
                      Done
                    </button>
                  </div>
                </div>,
                document.body,
              )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          <button
            type="button"
            onClick={onApply}
            className="bg-[#C6E4D1] hover:bg-[#B1D8BD] text-[#16730F] font-bold text-xs px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-150 shadow-xs active:scale-95 whitespace-nowrap"
          >
            Apply Filter
          </button>
          <button
            type="button"
            onClick={onReset}
            className="bg-[#E5E7EB] hover:bg-gray-300 text-gray-700 font-semibold text-xs px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all duration-150 active:scale-95 whitespace-nowrap"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
