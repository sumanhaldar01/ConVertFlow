import { Upload, Cog, Download } from 'lucide-react';

export default function HowItWorks() {
  const steps = [
    {
      icon: <Upload className="w-6 h-6" />,
      title: 'Upload',
      description: 'Select your file or drag & drop it into the upload zone',
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/20',
    },
    {
      icon: <Cog className="w-6 h-6" />,
      title: 'Convert',
      description: 'Your file is processed instantly right in your browser',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
    },
    {
      icon: <Download className="w-6 h-6" />,
      title: 'Download',
      description: 'Get your converted file — no waiting, no emails',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
  ];

  return (
    <section className="mb-12">
      <h3 className="text-center text-sm font-semibold uppercase tracking-wider text-gray-500 mb-6">
        How it works
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className={`relative flex flex-col items-center text-center p-5 rounded-xl ${step.bgColor} border ${step.borderColor}`}
          >
            {/* Step number */}
            <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gray-950 border-2 ${step.borderColor} flex items-center justify-center text-xs font-bold ${step.color}`}>
              {index + 1}
            </div>
            <div className={`${step.color} mb-3 mt-1`}>{step.icon}</div>
            <h4 className="text-sm font-semibold text-gray-200 mb-1">{step.title}</h4>
            <p className="text-xs text-gray-400">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
