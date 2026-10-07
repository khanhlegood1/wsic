"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { loginStrings, type LoginLang } from "./loginStrings";

interface AnonymousHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: LoginLang;
}

export default function AnonymousHelpDialog({
  open,
  onOpenChange,
  lang,
}: AnonymousHelpDialogProps) {
  const t = loginStrings[lang];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-160">
        <div className="bg-linear-to-br from-emerald-700 via-emerald-600 to-teal-500 px-5 py-4 pr-12">
          <DialogTitle className="text-base font-black text-white">
            🌿 {t.helpTitle}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-white/70">
            {t.helpSubtitle}
          </DialogDescription>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/anonymous-profile-uuid.png"
            alt="Anonymous profile"
            className="block h-auto w-full"
          />
          <div className="space-y-4 px-5 pb-6 pt-5">
            <div className="text-[13px] font-extrabold uppercase tracking-wide text-emerald-600 dark:text-teal-300">
              🎬 {t.helpVideo}
            </div>
            <div className="mx-auto aspect-video w-full overflow-hidden rounded-xl border bg-black">
              <iframe
                src="https://www.youtube.com/embed/dw_8mIuH9DY?autoplay=0&rel=0&modestbranding=1"
                title={t.helpTitle}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="block size-full border-0"
              />
            </div>
            <p className="rounded-xl border border-emerald-600/25 bg-emerald-600/5 p-4 text-[13px] leading-relaxed">
              🔑 {t.helpBody}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
