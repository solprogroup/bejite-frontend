import React from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

export default function RecruitmentListTable({
  exercises = [],
  onViewExercise,
  activeCount = 7,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}) {
  const getStatusBadge = (status) => {
    const formatted = (status || "").toLowerCase();
    if (formatted === "open") {
      return (
        <span className="inline-block bg-[#E6F4EA] text-[#16730F] text-xs font-semibold px-3 py-1 rounded-full text-center">
          Open
        </span>
      );
    }
    if (formatted === "final stage" || formatted === "final_stage") {
      return (
        <span className="inline-block bg-[#EAEAEA] text-[#374151] text-xs font-semibold px-3 py-1 rounded-full text-center">
          Final Stage
        </span>
      );
    }
    return (
      <span className="inline-block bg-[#F3F4F6] text-gray-500 text-xs font-semibold px-3 py-1 rounded-full text-center">
        Closed
      </span>
    );
  };

  return (
    <div
      data-tour-id="rm-list"
      className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm flex flex-col"
    >
      {/* Top Header Row inside Table Container */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 bg-white">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#1A3E32] tracking-tight">
            My Recruitment Exercises
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-normal mt-0.5">
            Manage and monitor every recruitment exercise from one place.
          </p>
        </div>
        <div className="self-start sm:self-auto">
          <span className="inline-flex items-center bg-[#F3F4F6] text-gray-700 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-gray-200">
            Showing <strong className="text-[#1A3E32] mx-1">{exercises.length || activeCount}</strong> Active Exercises
          </span>
        </div>
      </div>

      {/* Responsive Table */}
      <div className="w-full overflow-x-auto nfl-scroll">
        <table className="w-full text-left border-collapse min-w-[840px]">
          <thead>
            <tr className="bg-[#1A3E32] text-white text-[11px] font-bold uppercase tracking-wider">
              <th className="py-3.5 px-4 rounded-tl-xl sm:rounded-none">Recruitment Title</th>
              <th className="py-3.5 px-4 text-center">Active Stage</th>
              <th className="py-3.5 px-4 text-center">Invited</th>
              <th className="py-3.5 px-4 text-center">Accepted</th>
              <th className="py-3.5 px-4 text-center">Declined</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-center">Last Updated</th>
              <th className="py-3.5 px-4 text-right rounded-tr-xl sm:rounded-none">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {exercises.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-400 font-medium text-sm">
                  No recruitment exercises found. Create one to get started.
                </td>
              </tr>
            ) : (
              exercises.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-emerald-50/40 transition-colors duration-150 group"
                >
                  {/* Title & Position */}
                  <td className="py-4 px-4 font-semibold text-[#16730F]">
                    <div className="text-sm font-bold text-[#16730F] group-hover:underline cursor-pointer" onClick={() => onViewExercise && onViewExercise(item)}>
                      {item.title}
                    </div>
                    <div className="text-xs font-normal text-gray-500 mt-0.5">
                      {item.position}
                    </div>
                  </td>

                  {/* Active Stage */}
                  <td className="py-4 px-4 text-center">
                    <span className="inline-block bg-[#F0F5F2] text-[#1A3E32] text-xs font-medium px-4 py-1.5 rounded-full border border-[#D5E5DD] max-w-[180px] truncate">
                      {item.activeStage}
                    </span>
                  </td>

                  {/* Counts */}
                  <td className="py-4 px-4 text-center font-bold text-gray-700">
                    {item.invited}
                  </td>
                  <td className="py-4 px-4 text-center font-extrabold text-[#16730F]">
                    {item.accepted}
                  </td>
                  <td className="py-4 px-4 text-center font-extrabold text-[#D93838]">
                    {item.declined}
                  </td>

                  {/* Status Badge */}
                  <td className="py-4 px-4 text-center">
                    {getStatusBadge(item.status)}
                  </td>

                  {/* Last Updated */}
                  <td className="py-4 px-4 text-center text-xs text-gray-500 font-normal">
                    {item.lastUpdated}
                  </td>

                  {/* Actions Button */}
                  <td className="py-4 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onViewExercise && onViewExercise(item)}
                      className="inline-flex items-center justify-center bg-[#16730F] hover:bg-[#125B0C] active:scale-95 text-white px-5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-xs"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 bg-white">
        <div className="text-xs text-gray-500 font-medium">
          Showing <strong>1</strong> to <strong>{exercises.length}</strong> exercises
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange && onPageChange(currentPage - 1)}
            className="w-8 h-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FaChevronLeft className="w-3 h-3" />
          </button>
          <span className="w-8 h-8 rounded-full bg-[#1A3E32] text-white font-bold text-xs flex items-center justify-center shadow-xs">
            {currentPage}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange && onPageChange(currentPage + 1)}
            className="w-8 h-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FaChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
