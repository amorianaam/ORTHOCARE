import React from 'react';
import { User, Phone, ChevronRight, Crown } from 'lucide-react';

export default function PatientExaminationCard({ 
  patient, 
  isSelected, 
  onClick, 
  isVIP, 
  isFollowUp,
  actionText,
  showDate, 
  dateValue 
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-3xl border transition-all cursor-pointer shadow-luxury hover-lift ${
        isSelected
          ? "bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200"
          : "bg-white border-gray-100 hover:border-indigo-150"
      }`}
      dir="rtl"
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm">
            {patient.full_name?.charAt(0)}
          </div>
          <div>
            <span className="font-extrabold text-xs text-gray-800 line-clamp-1">
              {patient.full_name}
            </span>
            <div className="text-[10px] text-gray-400 font-bold mt-1 space-y-1">
              <p className="flex items-center gap-1">
                <User size={11} /> العمر: {patient.age ? `${patient.age} سنة` : '—'} · {patient.gender === 'male' ? 'ذكر' : 'أنثى'}
              </p>
              {patient.phone && (
                <p className="flex items-center gap-1">
                  <Phone size={11} /> الهاتف: {patient.phone}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end">
          {isVIP && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black bg-amber-100 text-amber-800">
              <Crown size={10} /> إعفاء
            </span>
          )}
          {isFollowUp && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black bg-emerald-100 text-emerald-800">
              مراجعة
            </span>
          )}
        </div>
      </div>

      {(showDate || actionText) && (
        <div className="flex justify-between items-center border-t border-gray-50 pt-2 mt-3 text-[10px] font-black text-slate-500">
          {showDate && dateValue && <span>تاريخ التسجيل: {dateValue}</span>}
          {actionText && (
            <span className="flex items-center gap-0.5 mr-auto">
              {actionText}
              <ChevronRight size={14} className="text-slate-400 transition-transform" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
