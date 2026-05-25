import { motion } from "framer-motion";
import { ModelManager } from "@/components/models/ModelManager";

export function ModelsRoute() {
  return (
    <motion.div
      key="models"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      <ModelManager />
    </motion.div>
  );
}
