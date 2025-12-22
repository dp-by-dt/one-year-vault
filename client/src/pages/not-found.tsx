import { Link } from "wouter";
import { Button } from "@/components/ui-components";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F9F7F5] p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-stone-200 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-stone-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-serif font-bold text-stone-800">Page Not Found</h1>
          <p className="text-stone-500">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>

        <Link href="/">
          <Button className="w-full sm:w-auto">Return Home</Button>
        </Link>
      </div>
    </div>
  );
}
