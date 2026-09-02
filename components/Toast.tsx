"use client";
import { createContext, useCallback, useContext, useState, ReactNode } from "react";

const Ctx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msgs, setMsgs] = useState<{ id: number; text: string }[]>([]);
  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setMsgs((m) => [...m, { id, text }]);
    setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 2600);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toastwrap" role="status" aria-live="polite">
        {msgs.map((m) => <div key={m.id} className="toast">{m.text}</div>)}
      </div>
    </Ctx.Provider>
  );
}
