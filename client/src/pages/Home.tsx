import { useState, useEffect } from "react";
import { useVault } from "@/hooks/use-vault";
import { Button, Dialog, Input, Spinner } from "@/components/ui-components";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock, Download, ShieldCheck, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function Home() {
  const { state, saveDraft, lockVault, unlockVault, downloadVault, error } = useVault();
  
  // UI States
  const [content, setContent] = useState("");
  const [isLockModalOpen, setLockModalOpen] = useState(false);
  const [isUnlockModalOpen, setUnlockModalOpen] = useState(false);
  
  // Sync local content state with vault state
  useEffect(() => {
    if (state.status === "open") {
      setContent(state.content);
    }
  }, [state]);

  // Handle text changes with debounce
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);
    
    // Simple debounce for saving
    const timeoutId = setTimeout(() => {
      saveDraft(newText);
    }, 1000);
    return () => clearTimeout(timeoutId);
  };

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F7F5]">
        <Spinner className="w-8 h-8 text-stone-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md z-10 flex items-center justify-between px-4 sm:px-8 border-b border-emerald-200/30">
        <div className="flex items-center gap-2">
          {state.status === "locked" ? (
            <Lock className="w-5 h-5 text-red-500" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          )}
          <span className="font-serif font-bold text-lg tracking-tight">Vault</span>
        </div>
        
        <div className="flex items-center gap-3">
          {state.status === "open" ? (
            <div className="text-xs text-muted-foreground font-medium">
              Locks <span className="text-red-500">Jan 1, 2026</span>
            </div>
          ) : (
            <Button 
              variant="secondary" 
              size="sm"
              onClick={downloadVault}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Backup
            </Button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-24 pb-32 px-4 sm:px-8 max-w-3xl mx-auto min-h-screen flex flex-col">
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
                <p className="text-sm font-medium text-stone-400 uppercase tracking-widest">
                  {format(new Date(), "MMMM d, yyyy")}
                </p>
              </div>

              <textarea
                value={content}
                onChange={handleTextChange}
                placeholder="What changed you this year? What do you want to remember?..."
                className="w-full flex-1 bg-transparent border-none resize-none focus:ring-0 text-lg sm:text-xl leading-relaxed font-serif placeholder:text-stone-300 text-stone-800 outline-none p-0 min-h-[60vh]"
                spellCheck={false}
              />
              
              <div className="mt-8 text-center">
                <p className="text-xs text-stone-400">
                  {content.length > 0 ? "Changes saved locally" : "Start writing..."}
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
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <Lock className="w-10 h-10 text-red-500" />
              </div>
              
              <div className="space-y-4 max-w-md">
                <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground">
                  Vault Locked
                </h1>
                <p className="text-muted-foreground leading-relaxed">
                  Your thoughts are safely encrypted on this device. 
                  Only your password can reveal them.
                </p>
              </div>

              <div className="pt-8 w-full max-w-xs space-y-3">
                <Button 
                  onClick={() => setUnlockModalOpen(true)}
                  variant="default" 
                  className="w-full bg-red-500 hover:bg-red-600 text-white"
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Unlock with Password
                </Button>
                
                <p className="text-xs text-muted-foreground px-4">
                  Enter your password to view your memories again.
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
      
      {/* Error Toast (Simple implementation) */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg shadow-lg border border-red-100 flex items-center gap-3 animate-in slide-in-from-bottom-5">
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground mb-4">
          Enter your password to unlock your memories.
        </p>

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</label>
          <Input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading} className="w-32 bg-red-500 hover:bg-red-600 text-white">
            {loading ? <Spinner /> : "Unlock"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
