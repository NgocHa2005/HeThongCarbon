import { useEffect, useState } from "react";
import { layThangMuc } from "../../api/axiosClient.js";

export const MUC = [
  { khoa: "very low", ten: "Rất thấp", mau: "#0b6b57" },
  { khoa: "low", ten: "Thấp", mau: "#38b27d" },
  { khoa: "moderate", ten: "Trung bình", mau: "#e3b43f" },
  { khoa: "high", ten: "Cao", mau: "#ef8a3b" },
  { khoa: "very high", ten: "Rất cao", mau: "#d64545" },
];

let boNho = null;
let dangGoi = null;

function napThangMuc() {
  if (boNho) return Promise.resolve(boNho);
  if (!dangGoi) {
    dangGoi = layThangMuc()
      .then((d) => {
        boNho = d?.cac_muc || [];
        return boNho;
      })
      .catch(() => {
        dangGoi = null;
        return [];
      });
  }
  return dangGoi;
}

export function useThangMuc() {
  const [cacMuc, setCacMuc] = useState(boNho || []);
  useEffect(() => {
    let con = true;
    napThangMuc().then((d) => con && setCacMuc(d));
    return () => {
      con = false;
    };
  }, []);
  return cacMuc;
}

export function mucCuaGiaTri(giaTri, cacMuc) {
  if (giaTri === null || giaTri === undefined || !cacMuc?.length) return null;
  let ketQua = null;
  for (const m of cacMuc) {
    if (m.tu !== null && giaTri >= m.tu) ketQua = m;
  }
  const goc = ketQua || cacMuc.find((m) => m.tu !== null);
  if (!goc) return null;
  return { ...goc, mau: MUC.find((x) => x.khoa === goc.khoa)?.mau };
}