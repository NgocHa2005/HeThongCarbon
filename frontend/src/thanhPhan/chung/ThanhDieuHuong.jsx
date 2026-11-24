import React from "react";
import { Settings2, Zap } from "lucide-react";

export default function ThanhDieuHuong({ danhSach, dangChon }) {
  return (
    <aside className="kd-sider">
      <a className="kd-logo" href="#/tong-quan" aria-label="CarbonScope">
        <span className="kd-logo-o">
          <Zap size={18} />
        </span>
        <span>
          <strong>CarbonScope</strong>
          <small>Carbon Analytics</small>
        </span>
      </a>

      <p className="kd-nhom">Giám sát công khai</p>
      <nav className="kd-menu" aria-label="Chuyển trang">
        {danhSach.map(({ ma, ten, Icon }) => (
          <a
            key={ma}
            href={`#/${ma}`}
            className={ma === dangChon ? "kd-muc kd-muc-chon" : "kd-muc"}
            aria-current={ma === dangChon ? "page" : undefined}
          >
            <Icon size={18} />
            <span>{ten}</span>
          </a>
        ))}
      </nav>

      <p className="kd-nhom">Quản trị &amp; vận hành</p>
      <nav className="kd-menu">
        <a className="kd-muc" href="/admin">
          <Settings2 size={18} />
          <span>Quản trị dữ liệu</span>
          <em className="kd-nhan">Admin</em>
        </a>
      </nav>

      <div className="kd-chan">
        <span>Nguồn dữ liệu</span>
        <strong>Carbon Intensity API · GB</strong>
      </div>
    </aside>
  );
}
