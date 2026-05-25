import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import type { NotificationPayload } from "@/types/system";
import { cn } from "@/utils/cn";

const ICONS = {
  info: <Info size={14} className="text-cortex-info flex-shrink-0" />,
  success: <CheckCircle2 size={14} className="text-cortex-success flex-shrink-0" />,
  warning: <AlertTriangle size={14} className="text-cortex-warning flex-shrink-0" />,
  error: <AlertCircle size={14} className="text-cortex-error flex-shrink-0" />,
};

const BORDER_COLORS = {
  info: "border-cortex-info/30",
  success: "border-cortex-success/30",
  warning: "border-cortex-warning/30",
  error: "border-cortex-error/30",
};

export function NotificationStack() {
  const { notifications, removeNotification } = useUIStore();

  return (
    <div className="fixed bottom-8 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {notifications.map((n) => (
          <Notification key={n.id} notification={n} onDismiss={() => removeNotification(n.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Notification({
  notification,
  onDismiss,
}: {
  notification: NotificationPayload;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "pointer-events-auto flex items-start gap-3 px-3.5 py-3 rounded-xl",
        "bg-cortex-surface-2 border shadow-cortex-lg max-w-xs",
        BORDER_COLORS[notification.type],
      )}
    >
      {ICONS[notification.type]}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-cortex-text">{notification.title}</p>
        {notification.message && (
          <p className="text-xs text-cortex-text-muted mt-0.5">{notification.message}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="p-0.5 rounded text-cortex-text-dim hover:text-cortex-text transition-colors flex-shrink-0"
      >
        <X size={12} />
      </button>
    </motion.div>
  );
}
