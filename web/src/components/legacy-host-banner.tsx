/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useRef } from "react";

import { isLegacyHost, NEW_CONSOLE_ORIGIN } from "@/lib/legacy-host";

// The banner is fixed above everything, so push the fixed public header, the
// sticky app header and the sidebar down by its measured height.
const OFFSET_CSS = `
html[data-legacy-host] body { padding-top: var(--legacy-banner-h, 0px); }
html[data-legacy-host] header.fixed.top-0,
html[data-legacy-host] header.sticky.top-0 { top: var(--legacy-banner-h, 0px) !important; }
html[data-legacy-host] [data-slot='sidebar-container'] {
  top: calc(var(--app-header-height, 0px) + var(--legacy-banner-h, 0px)) !important;
  height: calc(100svh - var(--app-header-height, 0px) - var(--legacy-banner-h, 0px)) !important;
}
`;

export function LegacyHostBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const legacy =
    typeof window !== "undefined" && isLegacyHost(window.location.hostname);

  useEffect(() => {
    const node = ref.current;
    if (!legacy || !node) return;
    const root = document.documentElement;
    root.dataset.legacyHost = "";
    const sync = () =>
      root.style.setProperty("--legacy-banner-h", `${node.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => {
      observer.disconnect();
      delete root.dataset.legacyHost;
      root.style.removeProperty("--legacy-banner-h");
    };
  }, [legacy]);

  if (!legacy) return null;
  const target = `${NEW_CONSOLE_ORIGIN}${window.location.pathname}${window.location.search}`;
  return (
    <>
      <style>{OFFSET_CSS}</style>
      <div
        ref={ref}
        role="alert"
        className="fixed inset-x-0 top-0 z-[100] bg-amber-500 px-4 py-2.5 text-center text-sm leading-relaxed text-black"
      >
        <strong>服务升级通知：</strong>
        本站已迁移到新地址 <strong>api.leoapi.ai</strong>
        。旧的 API 地址和 Key 目前仍可继续使用，但从{" "}
        <strong>11 月 28 日</strong>
        起旧 API 地址将停止服务。你的
        Key、账户信息和余额等已完整迁移到新地址，请尽快更新。
        <a
          href={target}
          className="ml-2 inline-block rounded bg-black px-3 py-0.5 font-medium text-white hover:bg-black/80"
        >
          前往新地址 →
        </a>
      </div>
    </>
  );
}
