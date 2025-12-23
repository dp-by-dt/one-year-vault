import { useState, useEffect } from "react";
import { useVault } from "@/hooks/use-vault";
import { Button, Dialog, Input, Spinner } from "@/components/ui-components";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock, Download, ShieldCheck, AlertCircle, Snowflake } from "lucide-react";
import { useRef } from "react";


export default function Home() {
  const { state, saveDraft, lockVault, unlockVault, downloadVault, error } = useVault();
  
  // UI States
  const [content, setContent] = useState("");
  const [isLockModalOpen, setLockModalOpen] = useState(false);
  const [isUnlockModalOpen, setUnlockModalOpen] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Format date function
  const formatDate = (date: Date) => {
    const months = ["January", "February", "March", "April", "May", "June", 
                    "July", "August", "September", "October", "November", "December"];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  
  // Sync local content state with vault state
  useEffect(() => {
    if (state.status === "open" && state.content !== content) {
      setContent(state.content);
    }
  }, [state.status]);


  // Handle text changes with debounce
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus("saving");

    saveTimeoutRef.current = window.setTimeout(() => {
      saveDraft(newText);
      setSaveStatus("saved");
    }, 500);

  };


  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
        <Spinner className="w-8 h-8 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 text-foreground font-sans relative overflow-hidden">
      {/* Subtle winter background elements */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute top-10 right-20 text-slate-200">
          <Snowflake className="w-8 h-8 animate-pulse" style={{ animationDuration: '4s' }} />
        </div>
        <div className="absolute top-40 left-10 text-slate-200">
          <Snowflake className="w-6 h-6 animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        </div>
        <div className="absolute bottom-32 right-32 text-slate-200">
          <Snowflake className="w-5 h-5 animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        </div>
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/60 backdrop-blur-xl z-10 flex items-center justify-between px-4 sm:px-8 border-b border-slate-200/50 shadow-sm">
        <div className="flex items-center gap-2">
          {state.status === "locked" ? (
            <Lock className="w-5 h-5 text-blue-400" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-blue-500" />
          )}
          <span className="font-serif font-bold text-lg tracking-tight text-slate-700">Vault for Adithya</span>
        </div>
        
        <div className="flex items-center gap-3">
          {state.status === "open" ? (
            <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <Snowflake className="w-3 h-3 text-blue-300" />
              <span>Locks on <span className="text-blue-500">New Year</span></span>
            </div>
          ) : (
            <Button 
              variant="secondary" 
              size="sm"
              onClick={downloadVault}
              className="gap-2 bg-white/80 hover:bg-white text-slate-700 border-slate-200"
            >
              <Download className="w-4 h-4" />
              Backup
            </Button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-24 pb-32 px-4 sm:px-8 max-w-3xl mx-auto min-h-screen flex flex-col relative z-10">
        <AnimatePresence mode="wait">
          
          {/* OPEN STATE: WRITING AREA */}
          {state.status === "open" && (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col"
            >
              <div className="mb-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">
                  {formatDate(new Date())}
                </p>
                <p className="text-xs text-slate-400 italic">A gift to your future self</p>
              </div>

              <textarea
                value={content}
                onChange={handleTextChange}
                placeholder="What changed you this year? What do you want to remember?..."
                className="w-full flex-1 bg-white/40 backdrop-blur-sm border border-slate-200/50 rounded-lg shadow-sm resize-none focus:ring-2 focus:ring-blue-200/50 focus:border-blue-300/50 text-lg sm:text-xl leading-relaxed font-serif placeholder:text-slate-300 text-slate-700 outline-none p-6 min-h-[60vh] transition-all"
                spellCheck={false}
              />
              
              <div className="mt-8 flex flex-col items-center gap-3">
                <p className="text-xs text-slate-400 flex items-center gap-2">
                  {saveStatus === "saving" && (
                    <>
                      <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                      <span>Saving…</span>
                    </>
                  )}
                  {saveStatus === "saved" && (
                    <>
                      <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      <span>Saved locally</span>
                    </>
                  )}
                  {saveStatus === "idle" && "Start writing..."}
                </p>
              </div>

            </motion.div>
          )}

          {/* LOCKED STATE: COUNTDOWN & STATUS */}
          {state.status === "locked" && (
            <motion.div
              key="locked"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
            >
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-slate-100 rounded-full flex items-center justify-center mb-4 shadow-lg relative">
                <div className="absolute inset-0 rounded-full bg-blue-200/20 animate-pulse"></div>
                <Lock className="w-10 h-10 text-blue-500 relative z-10" />
              </div>
              
              <div className="space-y-4 max-w-md">
                <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-700">
                  Vault Sealed
                </h1>
                <p className="text-slate-500 leading-relaxed">
                  Your reflections are preserved in winter's embrace. 
                  They await you next Christmas.
                </p>
              </div>

              <div className="pt-8 w-full max-w-xs space-y-3">
                <Button 
                  onClick={() => setUnlockModalOpen(true)}
                  variant="default" 
                  className="w-full bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white shadow-md"
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Unlock with Password
                </Button>
                
                <p className="text-xs text-slate-400 px-4">
                  Enter your password to revisit your memories.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Unlock Dialog */}
      <UnlockDialog 
        isOpen={isUnlockModalOpen} 
        onClose={() => setUnlockModalOpen(false)}
        onConfirm={unlockVault}
      />
      
      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-white text-blue-600 px-4 py-3 rounded-lg shadow-xl border border-blue-100 flex items-center gap-3 animate-in slide-in-from-bottom-5 backdrop-blur-sm">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}
    </div>
  );
}

// === SUB-COMPONENTS ===

function UnlockDialog({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: (pw: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onConfirm(password);
      onClose();
      setPassword("");
    } catch (err: any) {
      setError("Incorrect password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Unlock Vault">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 mb-4">
          Enter your password to unlock your memories.
        </p>

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-500">Password</label>
          <Input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit(e);
              }
            }}
          />
        </div>

        {error && <p className="text-sm text-blue-500 font-medium">{error}</p>}

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="w-32 bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white">
            {loading ? <Spinner /> : "Unlock"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}