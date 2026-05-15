import { Heart, Shield, Code2 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-gray-800/50 bg-gray-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Privacy notice */}
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-emerald-400 mb-1">Privacy First</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                All file conversions happen directly in your browser. Your files are never uploaded to any server,
                never stored, and never logged. ConvertFlow is built with a privacy-first architecture
                that ensures your data stays on your device at all times.
              </p>
            </div>
          </div>
        </div>

        {/* Architecture info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-3 rounded-xl bg-gray-900/50 border border-gray-800/50">
            <h5 className="text-xs font-semibold text-violet-400 mb-1">🏗️ Architecture</h5>
            <p className="text-xs text-gray-500">
              Client-side processing with WebAssembly-powered libraries. Zero server dependency for conversions.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-gray-900/50 border border-gray-800/50">
            <h5 className="text-xs font-semibold text-cyan-400 mb-1">⚡ Performance</h5>
            <p className="text-xs text-gray-500">
              In-memory processing under 10MB. No blocking operations. Optimized for instant conversions.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-gray-900/50 border border-gray-800/50">
            <h5 className="text-xs font-semibold text-emerald-400 mb-1">🔒 Security</h5>
            <p className="text-xs text-gray-500">
              File validation (type + size). No persistence. Auto cleanup. Safe sandboxed parsing.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span>Built with</span>
            <Heart className="w-3 h-3 text-red-400" />
            <span>using React, Vite & open-source libraries</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" />
              Open Source
            </span>
            <span>•</span>
            <span>Free Forever</span>
            <span>•</span>
            <span>No Tracking</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
