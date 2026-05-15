import { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HowItWorks from '@/components/HowItWorks';
import ConversionCard from '@/components/ConversionCard';
import DropZone from '@/components/DropZone';
import ProgressBar from '@/components/ProgressBar';
import DownloadButton from '@/components/DownloadButton';
import { CONVERSION_OPTIONS, ConversionType, ConversionStatus, ConversionOption } from '@/types';
import { getOutputFileName } from '@/utils/fileHelpers';
import { convertFile } from '@/utils/converters';

export default function App() {
  // State management
  const [selectedOption, setSelectedOption] = useState<ConversionOption | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<ConversionStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFileName, setResultFileName] = useState<string>('');

  // Refs for scrolling
  const uploadRef = useRef<HTMLDivElement>(null);
  const convertRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to upload section when option is selected
  useEffect(() => {
    if (selectedOption && uploadRef.current) {
      setTimeout(() => {
        uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }, [selectedOption]);

  // Auto-scroll to convert section when files are added
  useEffect(() => {
    if (files.length > 0 && convertRef.current) {
      setTimeout(() => {
        convertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, [files.length]);

  // Handle conversion type selection
  const handleSelectOption = useCallback((option: ConversionOption) => {
    if (status === 'converting') return;
    setSelectedOption(option);
    setFiles([]);
    setStatus('idle');
    setProgress(0);
    setError(undefined);
    setResultBlob(null);
    setResultFileName('');
  }, [status]);

  // Handle files being added
  const handleFilesAdded = useCallback((newFiles: File[]) => {
    if (selectedOption?.id === 'pdf-merge') {
      setFiles((prev) => [...prev, ...newFiles]);
    } else {
      setFiles(newFiles);
    }
    setStatus('idle');
    setProgress(0);
    setError(undefined);
    setResultBlob(null);
  }, [selectedOption]);

  // Handle file removal
  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle conversion
  const handleConvert = useCallback(async () => {
    if (!selectedOption || files.length === 0) return;

    setStatus('validating');
    setProgress(0);
    setError(undefined);
    setResultBlob(null);

    try {
      // Small delay for UX feedback
      await new Promise((r) => setTimeout(r, 400));

      setStatus('converting');

      const blob = await convertFile(
        selectedOption.id as ConversionType,
        files,
        (p) => setProgress(p)
      );

      // Generate output filename
      const outputExt = selectedOption.toFormat.toLowerCase();
      let outputName: string;
      if (selectedOption.id === 'pdf-merge') {
        outputName = `merged_document.${outputExt}`;
      } else {
        outputName = getOutputFileName(files[0].name, outputExt);
      }

      setResultBlob(blob);
      setResultFileName(outputName);
      setStatus('completed');
      setProgress(100);
    } catch (err) {
      console.error('Conversion error:', err);
      setStatus('error');
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during conversion. Please try again.'
      );
    }
  }, [selectedOption, files]);

  // Reset everything
  const handleReset = useCallback(() => {
    setSelectedOption(null);
    setFiles([]);
    setStatus('idle');
    setProgress(0);
    setError(undefined);
    setResultBlob(null);
    setResultFileName('');
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const isConverting = status === 'converting' || status === 'validating';
  const canConvert = files.length > 0 && !isConverting && status !== 'completed';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* How It Works */}
        {!selectedOption && <HowItWorks />}

        {/* Step 1: Choose Conversion Type */}
        <section className="mb-10">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 text-violet-400 text-sm font-bold">
              1
            </div>
            <h2 className="text-lg font-semibold text-gray-200">
              Choose conversion type
            </h2>
            {selectedOption && (
              <span className="ml-2 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-violet-500/15 text-violet-400 border border-violet-500/20">
                {selectedOption.title}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONVERSION_OPTIONS.map((option) => (
              <ConversionCard
                key={option.id}
                option={option}
                isSelected={selectedOption?.id === option.id}
                onClick={() => handleSelectOption(option)}
              />
            ))}
          </div>
        </section>

        {/* Step 2: Upload File */}
        {selectedOption && (
          <section ref={uploadRef} className="mb-10 animate-fade-in-up">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 text-violet-400 text-sm font-bold">
                2
              </div>
              <h2 className="text-lg font-semibold text-gray-200">
                Upload your {selectedOption.fromFormat} file{selectedOption.id === 'pdf-merge' ? 's' : ''}
              </h2>
            </div>

            <DropZone
              option={selectedOption}
              files={files}
              onFilesAdded={handleFilesAdded}
              onRemoveFile={handleRemoveFile}
              disabled={isConverting}
            />
          </section>
        )}

        {/* Step 3: Convert & Download */}
        {selectedOption && files.length > 0 && (
          <section ref={convertRef} className="mb-10 animate-fade-in-up">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 text-violet-400 text-sm font-bold">
                3
              </div>
              <h2 className="text-lg font-semibold text-gray-200">
                {status === 'completed' ? 'Download your file' : 'Convert & Download'}
              </h2>
            </div>

            <div className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800/50 space-y-5">
              {/* Conversion summary */}
              {canConvert && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-400">
                      {files.length === 1
                        ? `Ready to convert "${files[0].name}"`
                        : `Ready to process ${files.length} files`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedOption.fromFormat} → {selectedOption.toFormat} • All processing happens in your browser
                    </p>
                  </div>
                  <button
                    onClick={handleConvert}
                    className="
                      group flex items-center justify-center gap-2.5
                      w-full sm:w-auto px-8 py-3.5 rounded-xl
                      font-semibold text-white
                      bg-gradient-to-r from-violet-600 to-cyan-600
                      hover:from-violet-500 hover:to-cyan-500
                      shadow-xl shadow-violet-500/20 hover:shadow-violet-500/30
                      transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]
                    "
                  >
                    <Sparkles className="w-5 h-5 transition-transform group-hover:rotate-12" />
                    <span>Convert Now</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              )}

              {/* Progress */}
              <ProgressBar status={status} progress={progress} error={error} />

              {/* Download */}
              {status === 'completed' && resultBlob && (
                <DownloadButton
                  blob={resultBlob}
                  fileName={resultFileName}
                  onReset={handleReset}
                />
              )}

              {/* Error retry */}
              {status === 'error' && (
                <div className="flex gap-3 animate-fade-in-up">
                  <button
                    onClick={handleConvert}
                    className="
                      px-6 py-3 rounded-xl font-medium
                      text-white bg-violet-600 hover:bg-violet-500
                      transition-all duration-300
                    "
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleReset}
                    className="
                      px-6 py-3 rounded-xl font-medium
                      text-gray-300 bg-gray-800 hover:bg-gray-700
                      transition-all duration-300
                    "
                  >
                    Start Over
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Empty state when no option selected */}
        {!selectedOption && (
          <div className="text-center py-8 text-gray-600">
            <div className="text-4xl mb-3 animate-float">☝️</div>
            <p className="text-sm">Select a conversion type above to get started</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
