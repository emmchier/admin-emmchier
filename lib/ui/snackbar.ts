import { toast as shadcnToast } from "@/hooks/use-toast";

function normalize(msg: unknown): string {
  if (msg instanceof Error) return msg.message;
  if (typeof msg === "string") return msg;
  return "Operación realizada";
}

export const toast = {
  success(message: unknown) {
    shadcnToast({ description: normalize(message), variant: "success" as any });
  },
  error(message: unknown) {
    shadcnToast({ description: normalize(message), variant: "destructive" as any });
  },
  info(message: unknown) {
    shadcnToast({ description: normalize(message) });
  },
  warning(message: unknown) {
    shadcnToast({ description: normalize(message) });
  },
};

