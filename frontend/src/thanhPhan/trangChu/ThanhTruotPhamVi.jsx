import React from "react";

export default function ThanhTruotPhamVi({ tong, phamVi, onDoi }) {
  const soDiem = phamVi[1] - phamVi[0] + 1;
  const toiDa = Math.max(0, tong - soDiem);
  if (toiDa === 0) return null;

  return (
    <div className="thanh-truot-pham-vi">
      <span>Đầu</span>
      <input
        type="range"
        min={0}
        max={toiDa}
        step={1}
        value={Math.min(phamVi[0], toiDa)}
        onChange={(e) => {
          const dau = Number(e.target.value);
          onDoi([dau, dau + soDiem - 1]);
        }}
        aria-label="Kéo để xem các phần khác của biểu đồ"
      />
      <span>Cuối</span>
    </div>
  );
}