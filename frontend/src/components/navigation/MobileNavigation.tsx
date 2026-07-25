import { X } from "lucide-react";
import { useEffect } from "react";

import { SidebarHeader } from "./SidebarHeader";
import { SidebarNavigation } from "./SidebarNavigation";

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavigation({ isOpen, onClose }: MobileNavigationProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        aria-label="Cerrar menú principal"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-label="Menú principal"
        aria-modal="true"
        className="relative flex h-full w-[min(86vw,320px)] flex-col bg-[#071a34] text-white shadow-2xl"
        role="dialog"
      >
        <div className="relative">
          <SidebarHeader isCollapsed={false} />
          <button
            aria-label="Cerrar menú principal"
            className="absolute right-3 top-4 inline-flex size-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <SidebarNavigation isCollapsed={false} />
      </aside>
    </div>
  );
}
