import { FileText, Shield, Zap } from 'lucide-react';

export default function Header() {
  return (
    <header className="relative overflow-hidden border-b border-gray-800/50">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/40 via-gray-950 to-cyan-950/30" />
      <div className="absolute inset-0 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center opacity-10" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-gray-950 flex items-center justify-center">
                <Zap className="w-3 h-3 text-white" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold">
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                ConvertFlow
              </span>
            </h1>
          </div>

          {/* Tagline */}
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-6">
            Convert your files <span className="text-violet-400 font-medium">instantly</span> and{' '}
            <span className="text-cyan-400 font-medium">privately</span> — right in your browser
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>100% Private</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span>Instant Processing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-violet-400" />
              <span>No File Storage</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
