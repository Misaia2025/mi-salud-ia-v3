"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = (e.currentTarget.email as HTMLInputElement).value;
    if (!email) return;
    setLoading(true);
    await signIn(email);
    setLoading(false);
    onClose();
    alert("¡Revisa tu correo para el enlace mágico!");
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-80 space-y-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Inicia sesión
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            name="email"
            type="email"
            placeholder="tu@correo.com"
            required
            disabled={loading}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Enviar enlace"}
          </Button>
        </form>

        <Button variant="ghost" className="w-full" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
