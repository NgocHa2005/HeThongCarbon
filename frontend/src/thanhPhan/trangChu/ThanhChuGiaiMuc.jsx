import React from "react";
import { MUC, useThangMuc } from "./thangMuc.js";

export default function ThanhChuGiaiMuc() {
  const cacMuc = useThangMuc();
  if (!cacMuc.length) return null;

  return (
    <div className="pt-chu-giai-muc" aria-label="Thang mức cường độ carbon">
      <span className="pt-chu-giai-tieu-de">Thang mức (gCO₂/kWh):</span>
      {cacMuc.map((m, i) => {
        if (m.tu === null) return null;
        const tiep = cacMuc.slice(i + 1).find((x) => x.tu !== null)?.tu;
        let khoang;
        if (tiep === undefined) khoang = `từ ${m.tu} trở lên`;
        else if (i === 0) khoang = `dưới ${tiep}`;
        else khoang = `${m.tu}–${tiep - 1}`;
        const mau = MUC.find((x) => x.khoa === m.khoa)?.mau;
        return (
          <span key={m.khoa} className="pt-chu-giai-o">
            <i style={{ background: mau }} />
            {m.ten} ({khoang})
          </span>
        );
      })}
    </div>
  );
}