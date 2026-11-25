import React from "react";
import { Settings2, Zap } from "lucide-react";

export default function ThanhDieuHuong({ danhSach, dangChon, dangMo = false, onDong }) {
  return (
    <aside className={dangMo ? "kd-sider kd-sider-mo" : "kd-sider"}>
      <a className="kd-logo" href="#/tong-quan" aria-label="ECO-GRID" onClick={onDong}>
        <span className="kd-logo-o">
          <Zap size={18} />
        </span>
        <span>
          <strong>ECO-GRID</strong>
          <small>Metrics Analytics</small>
        </span>
      </a>

      <p className="kd-nhom">Giám sát công khai</p>
      <nav className="kd-menu" aria-label="Chuyển trang">
        {danhSach.map(({ ma, ten, Icon, chucNang }) =>
          chucNang ? (
            <a
              key={ma}
              href={`#/${ma}`}
              className={ma === dangChon ? "kd-muc kd-muc-chon" : "kd-muc"}
              aria-current={ma === dangChon ? "page" : undefined}
              onClick={onDong}
            >
              <Icon size={18} />
              <span>{ten}</span>
            </a>
          ) : (
            <span
              key={ma}
              className="kd-muc kd-muc-tat"
              aria-disabled="true"
              title="Chức năng này chưa mở"
            >
              <Icon size={18} />
              <span>{ten}</span>
              <em className="kd-nhan kd-nhan-xam">Sắp có</em>
            </span>
          )
        )}
      </nav>

      <p className="kd-nhom">Quản trị &amp; vận hành</p>
      <nav className="kd-menu">
        <a className="kd-muc" href="/admin">
          <Settings2 size={18} />
          <span>DataOps &amp; Pipeline</span>
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
