//Phần layout chung
import React, { useEffect, useState } from "react";
import {
  Activity,
  Car,
  ChevronRight,
  Clock,
  History,
  Home,
  LayoutGrid,
  Map,
  Menu,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

export const DANH_SACH_MENU_PUBLIC = [
  {
    id: "tong-quan",
    label: "Tổng quan lưới điện",
    breadcrumb: "National Grid Telemetry",
    icon: LayoutGrid,
  },
  {
    id: "du-bao-ev",
    label: "Dự báo & Sạc EV",
    breadcrumb: "EV Smart Charging Forecast",
    icon: Car,
  },
  {
    id: "khu-vuc-dno",
    label: "Tra cứu DNO Khu vực",
    breadcrumb: "Regional DNO Comparison",
    icon: Map,
  },
  {
    id: "thong-ke-lich-su",
    label: "Thống kê lịch sử",
    breadcrumb: "Historical Time-Series Analytics",
    icon: History,
  },
  {
    id: "thuat-toan-ai",
    label: "Thuật toán phân cụm AI",
    breadcrumb: "AI Knowledge Discovery",
    icon: Sparkles,
  },
];

function layGioUtcHienTai() {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC+0`;
}

export default function PublicLayout({ tabHienTai, onChonTab, children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [utcTime, setUtcTime] = useState(layGioUtcHienTai);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setUtcTime(layGioUtcHienTai());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const activeItem =
    DANH_SACH_MENU_PUBLIC.find((item) => item.id === tabHienTai) ||
    DANH_SACH_MENU_PUBLIC[0];

  const handleSelectMenu = (id) => {
    onChonTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* Lớp phủ nền tối khi mở menu trên mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR TRÁI CỐ ĐỊNH (Chỉ chứa 5 menu Public, đã bỏ Admin) */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-64 bg-[#0F172A] border-r border-slate-800 z-50 flex flex-col justify-between transition-transform duration-200 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col">
          {/* Logo thương hiệu ECO-GRID */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#EA580C] flex items-center justify-center text-white shadow-sm shrink-0">
                <Zap size={20} strokeWidth={2.4} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-base font-extrabold tracking-tight text-white">
                  ECO-GRID
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#EA580C]">
                  Metrics Analytics
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1"
              aria-label="Đóng menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Nhãn phân nhóm PUBLIC TELEMETRY */}
          <div className="px-4 pt-6 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Public Telemetry
            </span>
          </div>

          {/* Danh sách 5 màn hình Public */}
          <nav aria-label="Menu chức năng chính" className="flex flex-col gap-1 px-2.5">
            {DANH_SACH_MENU_PUBLIC.map((item) => {
              const IconComponent = item.icon;
              const isActive = tabHienTai === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectMenu(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left cursor-pointer transition-colors ${
                    isActive
                      ? "bg-[#EA580C] text-white font-semibold shadow-sm"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium"
                  }`}
                >
                  <IconComponent size={18} className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer trạng thái kết nối ở đáy Sidebar */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex flex-col gap-1.5 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span>Hệ thống</span>
            <span className="font-mono text-slate-300 font-semibold">
              v2.4-telemetry
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-slate-300">ESO Grid API: Connected</span>
          </div>
        </div>
      </aside>

      {/* KHUNG BÊN PHẢI: TOP HEADER + NỘI DUNG CHÍNH */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header Bar */}
        <header className="sticky top-0 h-16 bg-white border-b border-slate-200/90 z-30 px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Mở menu điều hướng"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb định vị trang */}
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 truncate"
            >
              <Home size={15} className="text-slate-400 shrink-0" />
              <span className="font-medium">ECO-GRID</span>
              <ChevronRight size={14} className="text-slate-400 shrink-0" />
              <span className="font-bold text-slate-900 truncate">
                {activeItem.label}
              </span>
            </nav>
          </div>

          {/* Cụm trạng thái thời gian thực bên phải Header */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-mono text-xs font-medium">
              <Clock size={14} />
              <span>{utcTime} • Live Sync</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="hidden sm:inline">Dữ liệu thời gian thực</span>
              <span className="sm:hidden">Live</span>
            </div>

            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 text-[#EA580C] text-xs font-bold">
              <Activity size={14} />
              <span>{activeItem.breadcrumb}</span>
            </div>
          </div>
        </header>

        {/* Vùng nội dung chính của 5 màn hình */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}